import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildContextBundle } from "@/services/risk-engine/context-bundle";
import { scoreTransaction } from "@/services/risk-engine/risk-scorer";
import type { RiskTier } from "@/services/risk-engine/threshold-policy";
import { createOtpChallenge } from "@/services/otp-engine/otp-service";

export interface SimulateTransactionInput {
  userId: string;
  accountId: string;
  merchant: string;
  category: string;
  amount: number;
  beneficiary: string | null;
  channel: "CARD" | "TRANSFER" | "ACH" | "ATM" | "ONLINE";
  fingerprintHash: string | null;
}

export interface SimulateTransactionResult {
  transactionId: string;
  score: number;
  tier: RiskTier;
  otpRequired: boolean;
  explanation: string;
  factors: { code: string; label: string; detail: string; contribution: number }[];
  otpChallengeId?: string;
  otpDemoCode?: string;
}

const ALERT_TITLES: Record<RiskTier, string> = {
  LOW: "Low-risk transaction",
  MEDIUM: "Transaction flagged for review",
  HIGH: "High-risk transaction detected",
};

const STEP_UP_ALERT_TITLE = "Additional verification required";

/**
 * Simulates a live payment for demo purposes: creates the transaction,
 * scores it against the user's behavioral baseline via the Adaptive Risk
 * Engine, persists the assessment, and raises an alert when the result
 * warrants customer or analyst attention.
 */
export async function simulateTransaction(
  input: SimulateTransactionInput
): Promise<SimulateTransactionResult> {
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId: input.userId },
  });
  if (!account) throw new Error("Account not found");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  const date = new Date();

  const transaction = await prisma.transaction.create({
    data: {
      accountId: input.accountId,
      date,
      amount: new Prisma.Decimal(input.amount),
      merchant: input.merchant,
      category: input.category,
      beneficiary: input.beneficiary,
      channel: input.channel,
      status: "PENDING",
      isSimulated: true,
    },
  });

  const context = await buildContextBundle({
    userId: input.userId,
    merchant: input.merchant,
    fingerprintHash: input.fingerprintHash,
    transactionId: transaction.id,
  });

  const result = scoreTransaction({
    amount: input.amount,
    date,
    otpThreshold: user.otpThreshold,
    context,
  });

  const finalStatus = result.otpRequired ? "PENDING" : "APPROVED";

  await prisma.$transaction([
    prisma.transaction.update({ where: { id: transaction.id }, data: { status: finalStatus } }),
    prisma.riskAssessment.create({
      data: {
        transactionId: transaction.id,
        score: result.score,
        tier: result.tier,
        explanation: result.explanation,
        otpRequired: result.otpRequired,
        factors: {
          create: result.factors.map((factor) => ({
            code: factor.code,
            label: factor.label,
            detail: factor.detail,
            weight: factor.weight,
            contribution: factor.contribution,
          })),
        },
      },
    }),
    ...(result.tier === "LOW"
      ? []
      : [
          prisma.alert.create({
            data: {
              userId: input.userId,
              transactionId: transaction.id,
              severity: result.tier,
              title: result.otpRequired ? STEP_UP_ALERT_TITLE : ALERT_TITLES[result.tier],
              body: result.explanation,
            },
          }),
        ]),
  ]);

  let otpChallengeId: string | undefined;
  let otpDemoCode: string | undefined;

  if (result.otpRequired) {
    const challenge = await createOtpChallenge({
      userId: input.userId,
      userEmail: user.email,
      transactionId: transaction.id,
      amount: input.amount,
      merchant: input.merchant,
      beneficiary: input.beneficiary,
    });
    otpChallengeId = challenge.challengeId;
    otpDemoCode = challenge.demoCode;
  }

  return {
    transactionId: transaction.id,
    score: result.score,
    tier: result.tier,
    otpRequired: result.otpRequired,
    explanation: result.explanation,
    factors: result.factors.map((factor) => ({
      code: factor.code,
      label: factor.label,
      detail: factor.detail,
      contribution: factor.contribution,
    })),
    otpChallengeId,
    otpDemoCode,
  };
}
