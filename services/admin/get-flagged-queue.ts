import { prisma } from "@/lib/prisma";
import { getAuditTrailGroupedByEntity, type AuditTrailEntry } from "@/services/audit/get-audit-trail";

export interface FlaggedQueueRow {
  id: string;
  date: Date;
  merchant: string;
  category: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "DENIED" | "FLAGGED" | "PAUSED_FOR_VERIFICATION";
  customerName: string;
  customerEmail: string;
  score: number;
  tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  explanation: string;
  recommendation: string | null;
  factors: { code: string; label: string; detail: string; contribution: number }[];
  contextSignals: { type: "CALL" | "SMS" | "LOCATION" | "DEVICE"; label: string; receivedAt: Date }[];
  otpChallenge: { status: "PENDING" | "VERIFIED" | "EXPIRED" | "FAILED"; attempts: number; maxAttempts: number } | null;
  alertStatus: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | null;
  auditTrail: AuditTrailEntry[];
}

const FLAGGED_QUEUE_LIMIT = 100;

export async function getFlaggedQueue(): Promise<FlaggedQueueRow[]> {
  const transactions = await prisma.transaction.findMany({
    where: { riskAssessment: { tier: { in: ["MEDIUM", "HIGH", "CRITICAL"] } } },
    orderBy: { date: "desc" },
    take: FLAGGED_QUEUE_LIMIT,
    include: {
      account: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
      riskAssessment: { include: { factors: { orderBy: { contribution: "desc" } } } },
      contextSignals: true,
      otpChallenges: { orderBy: { createdAt: "desc" }, take: 1 },
      alerts: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
    },
  });

  const flagged = transactions.filter((tx) => tx.riskAssessment);
  const auditTrailsByTransaction = await getAuditTrailGroupedByEntity(flagged.map((tx) => tx.id));

  return flagged.map((tx) => ({
    id: tx.id,
    date: tx.date,
    merchant: tx.merchant,
    category: tx.category,
    amount: Number(tx.amount),
    status: tx.status,
    customerName: `${tx.account.user.firstName} ${tx.account.user.lastName}`,
    customerEmail: tx.account.user.email,
    score: tx.riskAssessment!.score,
    tier: tx.riskAssessment!.tier,
    explanation: tx.riskAssessment!.explanation,
    recommendation: tx.riskAssessment!.recommendation,
    factors: tx.riskAssessment!.factors.map((factor) => ({
      code: factor.code,
      label: factor.label,
      detail: factor.detail,
      contribution: factor.contribution,
    })),
    contextSignals: tx.contextSignals.map((signal) => ({
      type: signal.type,
      label: (signal.payload as { label?: string }).label ?? signal.type,
      receivedAt: signal.receivedAt,
    })),
    otpChallenge: tx.otpChallenges[0]
      ? {
          status: tx.otpChallenges[0].status,
          attempts: tx.otpChallenges[0].attempts,
          maxAttempts: tx.otpChallenges[0].maxAttempts,
        }
      : null,
    alertStatus: tx.alerts[0]?.status ?? null,
    auditTrail: auditTrailsByTransaction.get(tx.id) ?? [],
  }));
}
