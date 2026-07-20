import { prisma } from "@/lib/prisma";
import { CONTEXT_SIGNAL_WINDOW_MS } from "@/lib/constants";

export interface ContextBundle {
  avgAmount: number | null;
  p95Amount: number | null;
  stdDevAmount: number | null;
  activeHours: number[] | null;
  hasUsedMerchantBefore: boolean;
  deviceTrusted: boolean | null;
  txCountLastHour: number;
  locationFlagged: boolean;
  callSignalActive: boolean;
  smsSignalActive: boolean;
}

export interface ContextBundleInput {
  userId: string;
  merchant: string;
  fingerprintHash: string | null;
  /** The transaction currently being scored — any matched signals are
   * attached to it so the risk breakdown can show what was "active". */
  transactionId: string;
}

const VELOCITY_WINDOW_MS = 60 * 60 * 1000;

/**
 * Assembles every input the Risk Engine needs to score a transaction: the
 * user's behavioral baseline, merchant familiarity, device trust, recent
 * activity velocity, and any simulated context signals (call/SMS/location)
 * recently injected by the Context Signal Simulator (Phase 5). Matched
 * signals are attached to this transaction so they show up in its risk
 * breakdown and aren't reused for a later transaction.
 */
export async function buildContextBundle(input: ContextBundleInput): Promise<ContextBundle> {
  const oneHourAgo = new Date(Date.now() - VELOCITY_WINDOW_MS);
  const signalWindowStart = new Date(Date.now() - CONTEXT_SIGNAL_WINDOW_MS);

  const [profile, merchantHistoryCount, device, txCountLastHour, pendingSignals] = await Promise.all([
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
    prisma.transaction.count({
      where: { account: { userId: input.userId }, date: { gte: oneHourAgo } },
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

  return {
    avgAmount: profile ? Number(profile.avgAmount) : null,
    p95Amount: profile ? Number(profile.p95Amount) : null,
    stdDevAmount: profile ? Number(profile.stdDevAmount) : null,
    activeHours: profile ? (profile.activeHours as number[]) : null,
    hasUsedMerchantBefore: merchantHistoryCount > 0,
    deviceTrusted: input.fingerprintHash ? (device?.trusted ?? false) : null,
    txCountLastHour,
    locationFlagged: Boolean(locationSignal),
    callSignalActive: Boolean(callSignal),
    smsSignalActive: Boolean(smsSignal),
  };
}
