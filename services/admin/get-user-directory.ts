import { prisma } from "@/lib/prisma";

export interface UserDirectoryRow {
  id: string;
  name: string;
  email: string;
  lastActivity: Date | null;
  openAlertCount: number;
  latestRiskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
}

export async function getUserDirectory(): Promise<UserDirectoryRow[]> {
  const users = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    include: {
      accounts: {
        select: {
          transactions: {
            orderBy: { date: "desc" },
            take: 1,
            select: { date: true, riskAssessment: { select: { tier: true } } },
          },
        },
      },
      alerts: { where: { status: "OPEN" }, select: { id: true } },
    },
  });

  return users.map((user) => {
    const latestTransactions = user.accounts
      .flatMap((account) => account.transactions)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    const latestTransaction = latestTransactions[0];

    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      lastActivity: latestTransaction?.date ?? null,
      openAlertCount: user.alerts.length,
      latestRiskTier: latestTransaction?.riskAssessment?.tier ?? null,
    };
  });
}
