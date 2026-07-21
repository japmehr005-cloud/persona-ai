import { prisma } from "@/lib/prisma";

export interface TransactionDetail {
  id: string;
  date: Date;
  merchant: string;
  category: string;
  amount: number;
  beneficiary: string | null;
  channel: "CARD" | "TRANSFER" | "ACH" | "ATM" | "ONLINE";
  status: "PENDING" | "APPROVED" | "DENIED" | "FLAGGED";
  isSimulated: boolean;
  accountName: string;
  accountMask: string;
  importedFromFilename: string | null;
  riskAssessment: {
    id: string;
    score: number;
    tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    confidence: number;
    explanation: string;
    otpRequired: boolean;
    factors: { code: string; label: string; detail: string; contribution: number }[];
    actualAmount: number;
    baseline: {
      avgAmount: number | null;
      p95Amount: number | null;
      medianAmount: number | null;
      sampleSize: number | null;
    };
  } | null;
  pendingOtpChallengeId: string | null;
  /** Set only while a High-Risk Verification context session is still
   * PENDING — links to `/verify/session/[id]` instead of directly to OTP. */
  pendingVerificationSession: boolean;
}

export async function getTransactionDetail(
  userId: string,
  transactionId: string
): Promise<TransactionDetail | null> {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, account: { userId } },
    include: {
      account: { select: { name: true, mask: true } },
      importJob: { select: { filename: true } },
      riskAssessment: { include: { factors: { orderBy: { contribution: "desc" } } } },
      otpChallenges: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!transaction) return null;

  return {
    id: transaction.id,
    date: transaction.date,
    merchant: transaction.merchant,
    category: transaction.category,
    amount: Number(transaction.amount),
    beneficiary: transaction.beneficiary,
    channel: transaction.channel,
    status: transaction.status,
    isSimulated: transaction.isSimulated,
    accountName: transaction.account.name,
    accountMask: transaction.account.mask,
    importedFromFilename: transaction.importJob?.filename ?? null,
    riskAssessment: transaction.riskAssessment
      ? {
          id: transaction.riskAssessment.id,
          score: transaction.riskAssessment.score,
          tier: transaction.riskAssessment.tier,
          confidence: transaction.riskAssessment.confidence,
          explanation: transaction.riskAssessment.explanation,
          otpRequired: transaction.riskAssessment.otpRequired,
          factors: transaction.riskAssessment.factors.map((factor) => ({
            code: factor.code,
            label: factor.label,
            detail: factor.detail,
            contribution: factor.contribution,
          })),
          actualAmount: Number(transaction.amount),
          baseline: {
            avgAmount:
              transaction.riskAssessment.baselineAvgAmount !== null
                ? Number(transaction.riskAssessment.baselineAvgAmount)
                : null,
            p95Amount:
              transaction.riskAssessment.baselineP95Amount !== null
                ? Number(transaction.riskAssessment.baselineP95Amount)
                : null,
            medianAmount:
              transaction.riskAssessment.baselineMedianAmount !== null
                ? Number(transaction.riskAssessment.baselineMedianAmount)
                : null,
            sampleSize: transaction.riskAssessment.baselineSampleSize,
          },
        }
      : null,
    pendingOtpChallengeId: transaction.otpChallenges[0]?.id ?? null,
    pendingVerificationSession: transaction.riskAssessment?.verificationStatus === "PENDING",
  };
}
