import { prisma } from "@/lib/prisma";

export interface AdminOverview {
  totalUsers: number;
  flaggedLast24h: number;
  openAlerts: number;
  avgRiskScore: number;
  riskDistribution: { tier: "LOW" | "MEDIUM" | "HIGH"; count: number }[];
  recentAlerts: {
    id: string;
    title: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    createdAt: Date;
    customerName: string;
  }[];
  topFlaggedTransactions: {
    id: string;
    merchant: string;
    amount: number;
    score: number;
    tier: "LOW" | "MEDIUM" | "HIGH";
    date: Date;
    customerName: string;
  }[];
}

const RECENT_ALERT_LIMIT = 5;
const FLAGGED_QUEUE_PREVIEW_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAdminOverview(): Promise<AdminOverview> {
  const dayAgo = new Date(Date.now() - DAY_MS);

  const [totalUsers, flaggedLast24h, openAlerts, scoreAggregate, tierCounts, recentAlerts, topFlagged] =
    await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.riskAssessment.count({ where: { tier: "HIGH", createdAt: { gte: dayAgo } } }),
      prisma.alert.count({ where: { status: "OPEN" } }),
      prisma.riskAssessment.aggregate({ _avg: { score: true } }),
      prisma.riskAssessment.groupBy({ by: ["tier"], _count: { tier: true } }),
      prisma.alert.findMany({
        orderBy: { createdAt: "desc" },
        take: RECENT_ALERT_LIMIT,
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
      prisma.transaction.findMany({
        where: { riskAssessment: { tier: { in: ["MEDIUM", "HIGH"] } } },
        orderBy: { date: "desc" },
        take: FLAGGED_QUEUE_PREVIEW_LIMIT,
        include: {
          riskAssessment: { select: { score: true, tier: true } },
          account: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
    ]);

  const tierOrder: Array<"LOW" | "MEDIUM" | "HIGH"> = ["LOW", "MEDIUM", "HIGH"];
  const riskDistribution = tierOrder.map((tier) => ({
    tier,
    count: tierCounts.find((entry) => entry.tier === tier)?._count.tier ?? 0,
  }));

  return {
    totalUsers,
    flaggedLast24h,
    openAlerts,
    avgRiskScore: Math.round(scoreAggregate._avg.score ?? 0),
    riskDistribution,
    recentAlerts: recentAlerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      createdAt: alert.createdAt,
      customerName: `${alert.user.firstName} ${alert.user.lastName}`,
    })),
    topFlaggedTransactions: topFlagged
      .filter((tx) => tx.riskAssessment)
      .map((tx) => ({
        id: tx.id,
        merchant: tx.merchant,
        amount: Number(tx.amount),
        score: tx.riskAssessment!.score,
        tier: tx.riskAssessment!.tier,
        date: tx.date,
        customerName: `${tx.account.user.firstName} ${tx.account.user.lastName}`,
      })),
  };
}
