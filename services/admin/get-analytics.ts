import { subDays, format } from "date-fns";

import { prisma } from "@/lib/prisma";

export interface AlertTrendPoint {
  date: string;
  count: number;
}

export interface DispositionSlice {
  disposition: "CONFIRMED_FRAUD" | "FALSE_POSITIVE" | "ESCALATED" | "UNREVIEWED";
  count: number;
}

export interface CategoryRiskPoint {
  category: string;
  count: number;
}

export interface AdminAnalytics {
  alertTrend: AlertTrendPoint[];
  dispositionBreakdown: DispositionSlice[];
  categoryBreakdown: CategoryRiskPoint[];
  falsePositiveRate: number | null;
  reviewedAlertCount: number;
}

const TREND_WINDOW_DAYS = 14;
const TOP_CATEGORY_LIMIT = 6;

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const windowStart = subDays(new Date(), TREND_WINDOW_DAYS - 1);

  const [recentAlerts, dispositionGroups, flaggedTransactions] = await Promise.all([
    prisma.alert.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.alert.groupBy({ by: ["disposition"], _count: { _all: true } }),
    prisma.transaction.findMany({
      where: { riskAssessment: { tier: { in: ["MEDIUM", "HIGH"] } } },
      select: { category: true },
    }),
  ]);

  const trendBuckets = new Map<string, number>();
  for (let i = 0; i < TREND_WINDOW_DAYS; i++) {
    trendBuckets.set(format(subDays(new Date(), TREND_WINDOW_DAYS - 1 - i), "MMM d"), 0);
  }
  for (const alert of recentAlerts) {
    const key = format(alert.createdAt, "MMM d");
    if (trendBuckets.has(key)) {
      trendBuckets.set(key, (trendBuckets.get(key) ?? 0) + 1);
    }
  }

  const dispositionBreakdown: DispositionSlice[] = dispositionGroups.map((group) => ({
    disposition: group.disposition,
    count: group._count._all,
  }));

  const confirmedFraud = dispositionBreakdown.find((d) => d.disposition === "CONFIRMED_FRAUD")?.count ?? 0;
  const falsePositive = dispositionBreakdown.find((d) => d.disposition === "FALSE_POSITIVE")?.count ?? 0;
  const reviewedAlertCount = confirmedFraud + falsePositive;

  const categoryCounts = new Map<string, number>();
  for (const tx of flaggedTransactions) {
    categoryCounts.set(tx.category, (categoryCounts.get(tx.category) ?? 0) + 1);
  }
  const categoryBreakdown = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_CATEGORY_LIMIT);

  return {
    alertTrend: Array.from(trendBuckets.entries()).map(([date, count]) => ({ date, count })),
    dispositionBreakdown,
    categoryBreakdown,
    falsePositiveRate: reviewedAlertCount > 0 ? Math.round((falsePositive / reviewedAlertCount) * 100) : null,
    reviewedAlertCount,
  };
}
