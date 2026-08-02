import { startOfMonth, subMonths } from "date-fns";

import { prisma } from "@/lib/prisma";
import { deriveSecurityStatus, type SecurityStatus } from "@/components/shared/security-status-badge";

export interface DashboardTransaction {
  id: string;
  date: Date;
  merchant: string;
  category: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "DENIED" | "FLAGGED" | "PAUSED_FOR_VERIFICATION";
  riskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
}

export interface DashboardAlert {
  id: string;
  title: string;
  body: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  createdAt: Date;
}

export interface DashboardSummary {
  totalBalance: number;
  primaryAccountMask: string;
  monthlySpending: number;
  previousMonthSpending: number;
  securityStatus: SecurityStatus;
  lastVerifiedAt: Date | null;
  recentTransactions: DashboardTransaction[];
  openAlerts: DashboardAlert[];
  hasAnyTransactions: boolean;
  hasBehavioralProfile: boolean;
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const previousMonthStart = startOfMonth(subMonths(now, 1));

  const accounts = await prisma.account.findMany({ where: { userId } });
  const accountIds = accounts.map((account) => account.id);
  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const primaryAccountMask = accounts[0]?.mask ?? "0000";

  const [currentMonthTx, previousMonthTx, recentTransactions, openAlerts, behavioralProfile, txCount] =
    await Promise.all([
      prisma.transaction.findMany({
        where: { accountId: { in: accountIds }, date: { gte: monthStart }, amount: { lt: 0 } },
        select: { amount: true },
      }),
      prisma.transaction.findMany({
        where: {
          accountId: { in: accountIds },
          date: { gte: previousMonthStart, lt: monthStart },
          amount: { lt: 0 },
        },
        select: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { accountId: { in: accountIds } },
        orderBy: { date: "desc" },
        take: 5,
        include: { riskAssessment: { select: { tier: true } } },
      }),
      prisma.alert.findMany({
        where: { userId, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.behavioralProfile.findUnique({ where: { userId } }),
      prisma.transaction.count({ where: { accountId: { in: accountIds } } }),
    ]);

  const monthlySpending = Math.abs(
    currentMonthTx.reduce((sum, tx) => sum + Number(tx.amount), 0)
  );
  const previousMonthSpending = Math.abs(
    previousMonthTx.reduce((sum, tx) => sum + Number(tx.amount), 0)
  );

  const openHighAlerts = openAlerts.filter((alert) => alert.severity === "HIGH").length;
  const openMediumAlerts = openAlerts.filter((alert) => alert.severity === "MEDIUM").length;

  return {
    totalBalance,
    primaryAccountMask,
    monthlySpending,
    previousMonthSpending,
    securityStatus: deriveSecurityStatus({ openHighAlerts, openMediumAlerts }),
    lastVerifiedAt: behavioralProfile?.updatedAt ?? null,
    recentTransactions: recentTransactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      merchant: tx.merchant,
      category: tx.category,
      amount: Number(tx.amount),
      status: tx.status,
      riskTier: tx.riskAssessment?.tier ?? null,
    })),
    openAlerts: openAlerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      body: alert.body,
      severity: alert.severity,
      createdAt: alert.createdAt,
    })),
    hasAnyTransactions: txCount > 0,
    hasBehavioralProfile: Boolean(behavioralProfile),
  };
}
