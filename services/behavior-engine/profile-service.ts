import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { calculateBehavioralBaseline } from "@/services/behavior-engine/baseline-calculator";

const MIN_TRANSACTIONS = 30;
const MIN_HISTORY_DAYS = 14;
const BASELINE_WINDOW_DAYS = 90;

export interface RecalculateResult {
  updated: boolean;
  reason?: "insufficient-data";
  sampleSize: number;
}

/**
 * Rebuilds a user's behavioral baseline from their spending history.
 * Requires at least MIN_TRANSACTIONS transactions or MIN_HISTORY_DAYS days
 * of history before a baseline is considered statistically meaningful.
 */
export async function recalculateBehavioralProfile(userId: string): Promise<RecalculateResult> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - BASELINE_WINDOW_DAYS);

  const transactions = await prisma.transaction.findMany({
    where: {
      account: { userId },
      status: "APPROVED",
      amount: { lt: 0 },
      date: { gte: windowStart },
    },
    select: { date: true, amount: true, merchant: true },
  });

  const oldestDate = transactions.reduce(
    (min, tx) => (tx.date < min ? tx.date : min),
    new Date()
  );
  const historyDays = (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);

  if (transactions.length < MIN_TRANSACTIONS && historyDays < MIN_HISTORY_DAYS) {
    return { updated: false, reason: "insufficient-data", sampleSize: transactions.length };
  }

  const baseline = calculateBehavioralBaseline(
    transactions.map((tx) => ({ date: tx.date, amount: Number(tx.amount), merchant: tx.merchant }))
  );

  const existing = await prisma.behavioralProfile.findUnique({ where: { userId } });

  await prisma.behavioralProfile.upsert({
    where: { userId },
    create: {
      userId,
      version: 1,
      avgAmount: baseline.avgAmount,
      medianAmount: baseline.medianAmount,
      p95Amount: baseline.p95Amount,
      stdDevAmount: baseline.stdDevAmount,
      txPerDay: baseline.txPerDay,
      topMerchants: baseline.topMerchants as unknown as Prisma.InputJsonValue,
      activeHours: baseline.activeHours as unknown as Prisma.InputJsonValue,
      sampleSize: baseline.sampleSize,
    },
    update: {
      version: (existing?.version ?? 0) + 1,
      avgAmount: baseline.avgAmount,
      medianAmount: baseline.medianAmount,
      p95Amount: baseline.p95Amount,
      stdDevAmount: baseline.stdDevAmount,
      txPerDay: baseline.txPerDay,
      topMerchants: baseline.topMerchants as unknown as Prisma.InputJsonValue,
      activeHours: baseline.activeHours as unknown as Prisma.InputJsonValue,
      sampleSize: baseline.sampleSize,
    },
  });

  return { updated: true, sampleSize: baseline.sampleSize };
}
