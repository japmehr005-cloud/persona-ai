import { prisma } from "@/lib/prisma";
import { CONTEXT_SIGNAL_WINDOW_MS } from "@/lib/constants";
import type {
  CallSignalSubtype,
  DeviceSignalSubtype,
  LocationSignalSubtype,
  SmsSignalSubtype,
} from "@/services/context-signals/inject-signal";

export interface ContextBundle {
  avgAmount: number | null;
  medianAmount: number | null;
  p95Amount: number | null;
  stdDevAmount: number | null;
  activeHours: number[] | null;
  activeDays: number[] | null;
  topMerchants: string[];
  sampleSize: number;

  hasUsedMerchantBefore: boolean;
  beneficiary: string | null;
  isFirstTimeBeneficiary: boolean;
  isDormantBeneficiary: boolean;

  deviceTrusted: boolean | null;
  deviceIntegritySubtype: DeviceSignalSubtype | null;

  accountBalance: number | null;
  txCountLastHour: number;
  txAmountLastDay: number;
  otpRequestCountLastHour: number;
  distinctBeneficiariesLastDay: number;

  locationFlagged: boolean;
  locationSeverity: LocationSignalSubtype | null;
  callSignalActive: boolean;
  callSignalSubtype: CallSignalSubtype | null;
  smsSignalActive: boolean;
  smsSignalSubtype: SmsSignalSubtype | null;
  screenShareActive: boolean;
  remoteAccessActive: boolean;
  accessibilityAbuseActive: boolean;
}

export interface ContextBundleInput {
  userId: string;
  accountId: string;
  merchant: string;
  beneficiary: string | null;
  fingerprintHash: string | null;
  /** The transaction currently being scored — any matched signals are
   * attached to it so the risk breakdown can show what was "active". */
  transactionId: string;
}

const VELOCITY_WINDOW_MS = 60 * 60 * 1000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const DORMANT_BENEFICIARY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Assembles every input the Risk Engine needs to score a transaction: the
 * user's behavioral baseline, merchant/recipient familiarity, device
 * trust/integrity, account velocity, and any simulated context signals
 * (call/SMS/location/device) recently injected by the Context Signal
 * Simulator. Matched signals are attached to this transaction so they show
 * up in its risk breakdown and aren't reused for a later transaction.
 */
export async function buildContextBundle(input: ContextBundleInput): Promise<ContextBundle> {
  const now = Date.now();
  const oneHourAgo = new Date(now - VELOCITY_WINDOW_MS);
  const oneDayAgo = new Date(now - DAY_WINDOW_MS);
  const dormantCutoff = new Date(now - DORMANT_BENEFICIARY_WINDOW_MS);
  const signalWindowStart = new Date(now - CONTEXT_SIGNAL_WINDOW_MS);

  const [
    profile,
    merchantHistoryCount,
    device,
    account,
    txCountLastHour,
    debitsLastDay,
    otpRequestCountLastHour,
    beneficiaryHistory,
    distinctBeneficiariesLastDay,
    pendingSignals,
  ] = await Promise.all([
    prisma.behavioralProfile.findUnique({ where: { userId: input.userId } }),
    prisma.transaction.count({
      where: {
        account: { userId: input.userId },
        merchant: input.merchant,
        status: { in: ["APPROVED", "FLAGGED"] },
      },
    }),
    input.fingerprintHash
      ? prisma.device.findUnique({
          where: { userId_fingerprintHash: { userId: input.userId, fingerprintHash: input.fingerprintHash } },
        })
      : Promise.resolve(null),
    prisma.account.findUnique({ where: { id: input.accountId }, select: { balance: true } }),
    prisma.transaction.count({
      where: { account: { userId: input.userId }, date: { gte: oneHourAgo } },
    }),
    prisma.transaction.findMany({
      where: {
        account: { userId: input.userId },
        amount: { lt: 0 },
        status: { in: ["APPROVED", "PENDING", "FLAGGED"] },
        date: { gte: oneDayAgo },
      },
      select: { amount: true },
    }),
    prisma.otpChallenge.count({
      where: { transaction: { account: { userId: input.userId } }, createdAt: { gte: oneHourAgo } },
    }),
    input.beneficiary
      ? prisma.transaction.findMany({
          where: { account: { userId: input.userId }, beneficiary: input.beneficiary },
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true },
        })
      : Promise.resolve([]),
    prisma.transaction.findMany({
      where: {
        account: { userId: input.userId },
        beneficiary: { not: null },
        date: { gte: oneDayAgo },
      },
      select: { beneficiary: true },
      distinct: ["beneficiary"],
    }),
    prisma.contextSignal.findMany({
      where: { userId: input.userId, transactionId: null, receivedAt: { gte: signalWindowStart } },
    }),
  ]);

  if (pendingSignals.length > 0) {
    await prisma.contextSignal.updateMany({
      where: { id: { in: pendingSignals.map((signal) => signal.id) } },
      data: { transactionId: input.transactionId },
    });
  }

  const locationSignal = pendingSignals.find((signal) => signal.type === "LOCATION");
  const callSignal = pendingSignals.find((signal) => signal.type === "CALL");
  const smsSignal = pendingSignals.find((signal) => signal.type === "SMS");
  const deviceSignals = pendingSignals.filter((signal) => signal.type === "DEVICE");

  const subtypeOf = (signal: (typeof pendingSignals)[number] | undefined): string | null => {
    if (!signal) return null;
    const payload = signal.payload as { subtype?: string | null };
    return payload.subtype ?? null;
  };

  const deviceSubtypeActive = (subtype: DeviceSignalSubtype): boolean =>
    deviceSignals.some((signal) => subtypeOf(signal) === subtype);

  const isFirstTimeBeneficiary = Boolean(input.beneficiary) && beneficiaryHistory.length === 0;
  const isDormantBeneficiary =
    Boolean(input.beneficiary) &&
    beneficiaryHistory.length > 0 &&
    beneficiaryHistory[0].date < dormantCutoff;

  const topMerchants = Array.isArray(profile?.topMerchants)
    ? (profile!.topMerchants as unknown as { merchant: string }[]).map((entry) => entry.merchant)
    : [];

  return {
    avgAmount: profile ? Number(profile.avgAmount) : null,
    medianAmount: profile ? Number(profile.medianAmount) : null,
    p95Amount: profile ? Number(profile.p95Amount) : null,
    stdDevAmount: profile ? Number(profile.stdDevAmount) : null,
    activeHours: profile ? (profile.activeHours as number[]) : null,
    activeDays: profile?.activeDays ? (profile.activeDays as number[]) : null,
    topMerchants,
    sampleSize: profile?.sampleSize ?? 0,

    hasUsedMerchantBefore: merchantHistoryCount > 0,
    beneficiary: input.beneficiary,
    isFirstTimeBeneficiary,
    isDormantBeneficiary,

    deviceTrusted: input.fingerprintHash ? (device?.trusted ?? false) : null,
    deviceIntegritySubtype:
      (["rooted", "emulator", "fingerprint-mismatch"] as const).find(deviceSubtypeActive) ?? null,

    accountBalance: account ? Number(account.balance) : null,
    txCountLastHour,
    txAmountLastDay: debitsLastDay.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0),
    otpRequestCountLastHour,
    distinctBeneficiariesLastDay: distinctBeneficiariesLastDay.length,

    locationFlagged: Boolean(locationSignal),
    locationSeverity: (subtypeOf(locationSignal) as LocationSignalSubtype | null) ?? (locationSignal ? "new-city" : null),
    callSignalActive: Boolean(callSignal),
    callSignalSubtype: subtypeOf(callSignal) as CallSignalSubtype | null,
    smsSignalActive: Boolean(smsSignal),
    smsSignalSubtype: subtypeOf(smsSignal) as SmsSignalSubtype | null,
    screenShareActive: deviceSubtypeActive("screen-share"),
    remoteAccessActive: deviceSubtypeActive("remote-access"),
    accessibilityAbuseActive: deviceSubtypeActive("accessibility-abuse"),
  };
}
