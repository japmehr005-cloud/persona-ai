import { prisma } from "@/lib/prisma";

export interface UserDrilldown {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  isDemo: boolean;
  accounts: { id: string; name: string; mask: string; balance: number }[];
  behavioralProfile: {
    avgAmount: number;
    medianAmount: number;
    p95Amount: number;
    txPerDay: number;
    sampleSize: number;
    updatedAt: Date;
  } | null;
  devices: { id: string; label: string; trusted: boolean; lastSeenAt: Date }[];
  recentTransactions: {
    id: string;
    date: Date;
    merchant: string;
    amount: number;
    status: "PENDING" | "APPROVED" | "DENIED" | "FLAGGED";
    riskTier: "LOW" | "MEDIUM" | "HIGH" | null;
  }[];
  openAlertCount: number;
}

const RECENT_TRANSACTIONS_LIMIT = 15;

export async function getUserDrilldown(userId: string): Promise<UserDrilldown | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "CUSTOMER" },
    include: {
      accounts: true,
      behavioralProfile: true,
      devices: { orderBy: { lastSeenAt: "desc" } },
      alerts: { where: { status: "OPEN" }, select: { id: true } },
    },
  });

  if (!user) return null;

  const accountIds = user.accounts.map((account) => account.id);
  const recentTransactions = await prisma.transaction.findMany({
    where: { accountId: { in: accountIds } },
    orderBy: { date: "desc" },
    take: RECENT_TRANSACTIONS_LIMIT,
    include: { riskAssessment: { select: { tier: true } } },
  });

  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    createdAt: user.createdAt,
    isDemo: user.isDemo,
    accounts: user.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      mask: account.mask,
      balance: Number(account.balance),
    })),
    behavioralProfile: user.behavioralProfile
      ? {
          avgAmount: Number(user.behavioralProfile.avgAmount),
          medianAmount: Number(user.behavioralProfile.medianAmount),
          p95Amount: Number(user.behavioralProfile.p95Amount),
          txPerDay: Number(user.behavioralProfile.txPerDay),
          sampleSize: user.behavioralProfile.sampleSize,
          updatedAt: user.behavioralProfile.updatedAt,
        }
      : null,
    devices: user.devices.map((device) => ({
      id: device.id,
      label: device.label,
      trusted: device.trusted,
      lastSeenAt: device.lastSeenAt,
    })),
    recentTransactions: recentTransactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      merchant: tx.merchant,
      amount: Number(tx.amount),
      status: tx.status,
      riskTier: tx.riskAssessment?.tier ?? null,
    })),
    openAlertCount: user.alerts.length,
  };
}
