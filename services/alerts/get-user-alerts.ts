import { prisma } from "@/lib/prisma";

export interface AlertRow {
  id: string;
  title: string;
  body: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  disposition: "UNREVIEWED" | "CONFIRMED_FRAUD" | "FALSE_POSITIVE" | "ESCALATED";
  createdAt: Date;
  transactionId: string | null;
  transactionMerchant: string | null;
  transactionAmount: number | null;
  riskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  riskScore: number | null;
  riskExplanation: string | null;
  otpRequired: boolean;
  factors: { code: string; label: string; detail: string; contribution: number }[];
}

export async function getUserAlerts(userId: string): Promise<AlertRow[]> {
  const alerts = await prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      transaction: {
        select: {
          merchant: true,
          amount: true,
          riskAssessment: {
            select: {
              tier: true,
              score: true,
              explanation: true,
              otpRequired: true,
              factors: { orderBy: { contribution: "desc" } },
            },
          },
        },
      },
    },
  });

  return alerts.map((alert) => ({
    id: alert.id,
    title: alert.title,
    body: alert.body,
    severity: alert.severity,
    status: alert.status,
    disposition: alert.disposition,
    createdAt: alert.createdAt,
    transactionId: alert.transactionId,
    transactionMerchant: alert.transaction?.merchant ?? null,
    transactionAmount: alert.transaction ? Number(alert.transaction.amount) : null,
    riskTier: alert.transaction?.riskAssessment?.tier ?? null,
    riskScore: alert.transaction?.riskAssessment?.score ?? null,
    riskExplanation: alert.transaction?.riskAssessment?.explanation ?? null,
    otpRequired: alert.transaction?.riskAssessment?.otpRequired ?? false,
    factors: (alert.transaction?.riskAssessment?.factors ?? []).map((factor) => ({
      code: factor.code,
      label: factor.label,
      detail: factor.detail,
      contribution: factor.contribution,
    })),
  }));
}
