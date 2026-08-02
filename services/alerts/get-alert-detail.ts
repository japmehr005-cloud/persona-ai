import { prisma } from "@/lib/prisma";

export interface AlertDetail {
  id: string;
  title: string;
  body: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  disposition: "UNREVIEWED" | "CONFIRMED_FRAUD" | "FALSE_POSITIVE" | "ESCALATED";
  createdAt: Date;
  resolvedAt: Date | null;
  transaction: {
    id: string;
    date: Date;
    merchant: string;
    amount: number;
    category: string;
    riskAssessment: {
      score: number;
      tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      confidence: number;
      explanation: string;
      recommendation: string | null;
      otpRequired: boolean;
      factors: { code: string; label: string; detail: string; contribution: number }[];
    } | null;
  } | null;
}

export async function getAlertDetail(userId: string, alertId: string): Promise<AlertDetail | null> {
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, userId },
    include: {
      transaction: {
        include: { riskAssessment: { include: { factors: { orderBy: { contribution: "desc" } } } } },
      },
    },
  });

  if (!alert) return null;

  return {
    id: alert.id,
    title: alert.title,
    body: alert.body,
    severity: alert.severity,
    status: alert.status,
    disposition: alert.disposition,
    createdAt: alert.createdAt,
    resolvedAt: alert.resolvedAt,
    transaction: alert.transaction
      ? {
          id: alert.transaction.id,
          date: alert.transaction.date,
          merchant: alert.transaction.merchant,
          amount: Number(alert.transaction.amount),
          category: alert.transaction.category,
          riskAssessment: alert.transaction.riskAssessment
            ? {
                score: alert.transaction.riskAssessment.score,
                tier: alert.transaction.riskAssessment.tier,
                confidence: alert.transaction.riskAssessment.confidence,
                explanation: alert.transaction.riskAssessment.explanation,
                recommendation: alert.transaction.riskAssessment.recommendation,
                otpRequired: alert.transaction.riskAssessment.otpRequired,
                factors: alert.transaction.riskAssessment.factors.map((factor) => ({
                  code: factor.code,
                  label: factor.label,
                  detail: factor.detail,
                  contribution: factor.contribution,
                })),
              }
            : null,
        }
      : null,
  };
}
