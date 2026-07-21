import { prisma } from "@/lib/prisma";

export interface TransactionRow {
  id: string;
  date: Date;
  merchant: string;
  category: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "DENIED" | "FLAGGED";
  riskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  accountName: string;
  accountMask: string;
}

const TRANSACTION_LIST_LIMIT = 500;

export async function getUserTransactions(userId: string): Promise<TransactionRow[]> {
  const transactions = await prisma.transaction.findMany({
    where: { account: { userId } },
    orderBy: { date: "desc" },
    take: TRANSACTION_LIST_LIMIT,
    include: {
      account: { select: { name: true, mask: true } },
      riskAssessment: { select: { tier: true } },
    },
  });

  return transactions.map((tx) => ({
    id: tx.id,
    date: tx.date,
    merchant: tx.merchant,
    category: tx.category,
    amount: Number(tx.amount),
    status: tx.status,
    riskTier: tx.riskAssessment?.tier ?? null,
    accountName: tx.account.name,
    accountMask: tx.account.mask,
  }));
}
