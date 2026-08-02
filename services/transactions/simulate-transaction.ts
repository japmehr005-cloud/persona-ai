import { randomBytes } from "crypto";

import { Prisma } from "@prisma/client";

import { VERIFICATION_SESSION_TTL_MS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { buildContextBundle } from "@/services/risk-engine/context-bundle";
import { getUserRiskThresholds } from "@/services/risk-engine/get-user-thresholds";
import { scoreTransaction } from "@/services/risk-engine/risk-scorer";
import type { RiskTier } from "@/services/risk-engine/threshold-policy";

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
  confidence: number;
  /** True once the score reaches the high-risk threshold. The customer must
   * complete the High-Risk Verification flow (`/verify/session/[id]`)
   * before a Context-Bound OTP is ever issued — see `verificationStatus`. */
  otpRequired: boolean;
  explanation: string;
  /** Plain-language recommended action for the Explainable AI panel. */
  recommendation: string;
  factors: { code: string; label: string; detail: string; contribution: number }[];
  /** "PENDING" when a High-Risk Verification context session was opened
   * (HIGH/CRITICAL); "NONE" when the transaction was approved outright. */
  verificationStatus: "NONE" | "PENDING";
  actualAmount: number;
  baseline: {
    avgAmount: number | null;
    p95Amount: number | null;
    medianAmount: number | null;
    sampleSize: number | null;
  };
}

const ALERT_TITLES: Record<RiskTier, string> = {
  LOW: "Low-risk transaction",
  MEDIUM: "Transaction flagged for review",
  HIGH: "High-risk transaction detected",
  CRITICAL: "Critical-risk transaction detected",
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

  const [context, thresholds] = await Promise.all([
    buildContextBundle({
      userId: input.userId,
      accountId: input.accountId,
      merchant: input.merchant,
      beneficiary: input.beneficiary,
      fingerprintHash: input.fingerprintHash,
      transactionId: transaction.id,
    }),
    getUserRiskThresholds(input.userId),
  ]);

  const result = scoreTransaction({
    amount: input.amount,
    date,
    thresholds,
    context,
  });

  // HIGH/CRITICAL transactions never execute (or issue an OTP) immediately —
  // they open a High-Risk Verification "context session" instead. The
  // customer must explicitly Cancel or Verify Identity before CB-OTP is
  // ever generated (see services/transactions/verification-session.ts).
  const finalStatus = result.otpRequired ? "PENDING" : "APPROVED";
  const sessionToken = result.otpRequired ? randomBytes(24).toString("base64url") : null;
  const verificationExpiresAt = result.otpRequired
    ? new Date(date.getTime() + VERIFICATION_SESSION_TTL_MS)
    : null;

  await prisma.$transaction([
    prisma.transaction.update({ where: { id: transaction.id }, data: { status: finalStatus } }),
    prisma.riskAssessment.create({
      data: {
        transactionId: transaction.id,
        score: result.score,
        tier: result.tier,
        confidence: result.confidence,
        explanation: result.explanation,
        otpRequired: result.otpRequired,
        verificationStatus: result.otpRequired ? "PENDING" : "NONE",
        verificationExpiresAt,
        sessionToken,
        // Captured now, at scoring time, rather than re-derived later when
        // the explainability panel renders — the live behavioral profile
        // keeps moving forward, so this preserves what the engine actually
        // knew when it made this decision.
        baselineAvgAmount:
          context.avgAmount !== null ? new Prisma.Decimal(context.avgAmount) : null,
        baselineP95Amount:
          context.p95Amount !== null ? new Prisma.Decimal(context.p95Amount) : null,
        baselineMedianAmount:
          context.medianAmount !== null ? new Prisma.Decimal(context.medianAmount) : null,
        baselineSampleSize: context.sampleSize,
        deviceTrusted: context.deviceTrusted,
        finRiskScore: result.finRiskScore,
        governmentRiskScore: result.governmentRiskScore,
        deviceSimilarityScore: result.deviceSimilarityScore,
        recommendation: result.recommendation,
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
              // AlertSeverity has no CRITICAL value of its own — a CRITICAL
              // risk tier is surfaced to analysts as the most severe alert
              // severity that already exists (HIGH), while the underlying
              // RiskAssessment.tier still records the true CRITICAL rating.
              severity: result.tier === "CRITICAL" ? "HIGH" : result.tier,
              title: result.otpRequired ? STEP_UP_ALERT_TITLE : ALERT_TITLES[result.tier],
              body: result.explanation,
            },
          }),
        ]),
  ]);

  return {
    transactionId: transaction.id,
    score: result.score,
    tier: result.tier,
    confidence: result.confidence,
    otpRequired: result.otpRequired,
    explanation: result.explanation,
    recommendation: result.recommendation,
    factors: result.factors.map((factor) => ({
      code: factor.code,
      label: factor.label,
      detail: factor.detail,
      contribution: factor.contribution,
    })),
    verificationStatus: result.otpRequired ? "PENDING" : "NONE",
    actualAmount: Math.abs(input.amount),
    baseline: {
      avgAmount: context.avgAmount,
      p95Amount: context.p95Amount,
      medianAmount: context.medianAmount,
      sampleSize: context.sampleSize,
    },
  };
}
