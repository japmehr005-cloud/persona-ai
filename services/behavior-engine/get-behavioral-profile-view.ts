import { prisma } from "@/lib/prisma";
import type { MerchantFrequency } from "@/services/behavior-engine/baseline-calculator";

export interface BehavioralProfileView {
  hasProfile: boolean;
  version: number;
  updatedAt: Date | null;
  avgAmount: number;
  medianAmount: number;
  p95Amount: number;
  stdDevAmount: number;
  txPerDay: number;
  sampleSize: number;
  topMerchants: MerchantFrequency[];
  activeHours: number[];
  progressTowardBaseline: { transactionCount: number; minRequired: number };
}

const MIN_TRANSACTIONS_FOR_BASELINE = 30;

export async function getBehavioralProfileView(userId: string): Promise<BehavioralProfileView> {
  const [profile, transactionCount] = await Promise.all([
    prisma.behavioralProfile.findUnique({ where: { userId } }),
    prisma.transaction.count({ where: { account: { userId }, status: "APPROVED", amount: { lt: 0 } } }),
  ]);

  if (!profile) {
    return {
      hasProfile: false,
      version: 0,
      updatedAt: null,
      avgAmount: 0,
      medianAmount: 0,
      p95Amount: 0,
      stdDevAmount: 0,
      txPerDay: 0,
      sampleSize: 0,
      topMerchants: [],
      activeHours: new Array(24).fill(0),
      progressTowardBaseline: {
        transactionCount,
        minRequired: MIN_TRANSACTIONS_FOR_BASELINE,
      },
    };
  }

  return {
    hasProfile: true,
    version: profile.version,
    updatedAt: profile.updatedAt,
    avgAmount: Number(profile.avgAmount),
    medianAmount: Number(profile.medianAmount),
    p95Amount: Number(profile.p95Amount),
    stdDevAmount: Number(profile.stdDevAmount),
    txPerDay: Number(profile.txPerDay),
    sampleSize: profile.sampleSize,
    topMerchants: (profile.topMerchants as unknown as MerchantFrequency[]) ?? [],
    activeHours: (profile.activeHours as unknown as number[]) ?? new Array(24).fill(0),
    progressTowardBaseline: {
      transactionCount,
      minRequired: MIN_TRANSACTIONS_FOR_BASELINE,
    },
  };
}
