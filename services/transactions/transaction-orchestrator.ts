import { randomBytes } from "crypto";

import { Prisma } from "@prisma/client";

import { VERIFICATION_SESSION_TTL_MS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { recordFinEvent } from "@/services/fin/fin-event-logger";
import { buildContextBundle } from "@/services/risk-engine/context-bundle";
import { getUserRiskThresholds } from "@/services/risk-engine/get-user-thresholds";
import { scoreTransaction } from "@/services/risk-engine/risk-scorer";
import type { RiskTier } from "@/services/risk-engine/threshold-policy";
import {
  collectSocialEngineeringSignals,
  evaluateSocialEngineering,
  quarantineCallSignalsForRiskIsolation,
  type SocialEngineeringEvaluation,
} from "@/services/social-engineering";

/**
 * Orchestrator decision surface for the payment simulator.
 * BLOCKED maps to Prisma `DENIED`. PENDING preserves the existing risk step-up path.
 */
export type OrchestratorDecision =
  | "APPROVED"
  | "BLOCKED"
  | "PAUSED_FOR_VERIFICATION"
  | "PENDING";

export interface OrchestratePaymentInput {
  userId: string;
  accountId: string;
  merchant: string;
  category: string;
  amount: number;
  beneficiary: string | null;
  channel: "CARD" | "TRANSFER" | "ACH" | "ATM" | "ONLINE";
  fingerprintHash: string | null;
  /**
   * True when the customer dismissed the Social Engineering pause and chose
   * Continue Anyway — SE will not re-interrupt this attempt.
   */
  acknowledgeSocialEngineering?: boolean;
}

export interface OrchestratedPaymentResult {
  transactionId: string;
  decision: OrchestratorDecision;
  score: number;
  tier: RiskTier;
  confidence: number;
  otpRequired: boolean;
  explanation: string;
  recommendation: string;
  factors: { code: string; label: string; detail: string; contribution: number }[];
  verificationStatus: "NONE" | "PENDING";
  actualAmount: number;
  baseline: {
    avgAmount: number | null;
    p95Amount: number | null;
    medianAmount: number | null;
    sampleSize: number | null;
  };
  socialEngineering: SocialEngineeringEvaluation;
}

const ALERT_TITLES: Record<RiskTier, string> = {
  LOW: "Low-risk transaction",
  MEDIUM: "Transaction flagged for review",
  HIGH: "High-risk transaction detected",
  CRITICAL: "Critical-risk transaction detected",
};

const STEP_UP_ALERT_TITLE = "Additional verification required";
const SE_PAUSE_ALERT_TITLE = "Transaction paused — social engineering protection";

/**
 * Payment pipeline:
 *   Collect SE snapshot → Quarantine CALL (risk isolation) → Risk Engine
 *   → Social Engineering Engine → Decision
 *
 * Risk Engine files are never modified; CALL quarantine ensures
 * `evaluateSimulatedCall` never contributes to the score on this path.
 */
export async function orchestratePayment(
  input: OrchestratePaymentInput
): Promise<OrchestratedPaymentResult> {
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId: input.userId },
  });
  if (!account) throw new Error("Account not found");

  // 1. Snapshot SE signals while CALL rows are still active.
  const seSnapshot = await collectSocialEngineeringSignals(input.userId);

  // 2. Isolate Risk Engine from CALL contributions.
  await quarantineCallSignalsForRiskIsolation(input.userId);

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

  // 3. Risk Engine (unchanged API).
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

  const risk = scoreTransaction({
    amount: input.amount,
    date,
    thresholds,
    context,
  });

  // 4. Social Engineering Engine (independent of risk score).
  const socialEngineering = evaluateSocialEngineering(seSnapshot);
  const sePause =
    socialEngineering.triggered &&
    socialEngineering.recommendedAction === "PAUSE_FOR_VERIFICATION" &&
    !input.acknowledgeSocialEngineering;

  const riskStepUp = risk.otpRequired;
  const verificationNeeded = sePause || riskStepUp;
  const sessionToken = verificationNeeded ? randomBytes(24).toString("base64url") : null;
  const verificationExpiresAt = verificationNeeded
    ? new Date(date.getTime() + VERIFICATION_SESSION_TTL_MS)
    : null;

  let decision: OrchestratorDecision;
  let finalStatus: "APPROVED" | "PENDING" | "PAUSED_FOR_VERIFICATION";

  if (sePause) {
    decision = "PAUSED_FOR_VERIFICATION";
    finalStatus = "PAUSED_FOR_VERIFICATION";
  } else if (riskStepUp) {
    decision = "PENDING";
    finalStatus = "PENDING";
  } else {
    decision = "APPROVED";
    finalStatus = "APPROVED";
  }

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: finalStatus },
    }),
    prisma.riskAssessment.create({
      data: {
        transactionId: transaction.id,
        score: risk.score,
        tier: risk.tier,
        confidence: risk.confidence,
        explanation: risk.explanation,
        otpRequired: risk.otpRequired,
        verificationStatus: verificationNeeded ? "PENDING" : "NONE",
        verificationExpiresAt,
        sessionToken,
        baselineAvgAmount:
          context.avgAmount !== null ? new Prisma.Decimal(context.avgAmount) : null,
        baselineP95Amount:
          context.p95Amount !== null ? new Prisma.Decimal(context.p95Amount) : null,
        baselineMedianAmount:
          context.medianAmount !== null ? new Prisma.Decimal(context.medianAmount) : null,
        baselineSampleSize: context.sampleSize,
        deviceTrusted: context.deviceTrusted,
        finRiskScore: risk.finRiskScore,
        governmentRiskScore: risk.governmentRiskScore,
        deviceSimilarityScore: risk.deviceSimilarityScore,
        aiRiskScore: risk.aiRiskScore,
        recommendation: risk.recommendation,
        factors: {
          create: risk.factors.map((factor) => ({
            code: factor.code,
            label: factor.label,
            detail: factor.detail,
            weight: factor.weight,
            contribution: factor.contribution,
          })),
        },
      },
    }),
    ...(risk.tier === "LOW" && !sePause
      ? []
      : [
          prisma.alert.create({
            data: {
              userId: input.userId,
              transactionId: transaction.id,
              severity:
                sePause || risk.tier === "CRITICAL" || risk.tier === "HIGH" ? "HIGH" : risk.tier,
              title: sePause
                ? SE_PAUSE_ALERT_TITLE
                : risk.otpRequired
                  ? STEP_UP_ALERT_TITLE
                  : ALERT_TITLES[risk.tier],
              body: sePause ? socialEngineering.explanation : risk.explanation,
            },
          }),
        ]),
  ]);

  if (sePause) {
    await recordFinEvent({
      type: "TRANSACTION_PAUSED_CALL_ACTIVE",
      severity: "HIGH",
      userId: input.userId,
      transactionId: transaction.id,
      beneficiary: input.beneficiary,
      summary: `Transaction to ${input.merchant} paused — social engineering protection`,
      metadata: {
        amount: Math.abs(input.amount),
        riskScore: risk.score,
        riskTier: risk.tier,
        activeSignals: socialEngineering.activeSignals.map((signal) => signal.id),
      },
    });
  }

  return {
    transactionId: transaction.id,
    decision,
    score: risk.score,
    tier: risk.tier,
    confidence: risk.confidence,
    otpRequired: risk.otpRequired,
    explanation: risk.explanation,
    recommendation: risk.recommendation,
    factors: risk.factors.map((factor) => ({
      code: factor.code,
      label: factor.label,
      detail: factor.detail,
      contribution: factor.contribution,
    })),
    verificationStatus: verificationNeeded ? "PENDING" : "NONE",
    actualAmount: Math.abs(input.amount),
    baseline: {
      avgAmount: context.avgAmount,
      p95Amount: context.p95Amount,
      medianAmount: context.medianAmount,
      sampleSize: context.sampleSize,
    },
    socialEngineering,
  };
}

/**
 * Customer chose Continue Anyway after an SE pause — finalize using the
 * already-computed risk outcome only (SE will not re-trigger).
 */
export async function continueAfterSocialEngineeringPause(
  userId: string,
  transactionId: string
): Promise<OrchestratedPaymentResult | null> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      status: "PAUSED_FOR_VERIFICATION",
      account: { userId },
    },
    include: {
      riskAssessment: { include: { factors: { orderBy: { contribution: "desc" } } } },
    },
  });

  if (!transaction?.riskAssessment) return null;

  const assessment = transaction.riskAssessment;
  const riskStepUp = assessment.otpRequired;
  const decision: OrchestratorDecision = riskStepUp ? "PENDING" : "APPROVED";

  // If risk does not require step-up, close the SE-opened verification session.
  if (!riskStepUp) {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transactionId },
        data: { status: "APPROVED" },
      }),
      prisma.riskAssessment.update({
        where: { id: assessment.id },
        data: {
          verificationStatus: "NONE",
          verificationExpiresAt: null,
          sessionToken: null,
        },
      }),
    ]);
  } else {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "PENDING" },
    });
  }

  const emptySe: SocialEngineeringEvaluation = {
    triggered: false,
    signals: [],
    activeSignals: [],
    explanation:
      "Social engineering pause acknowledged. Risk Engine decision applied independently.",
    recommendedAction: "ALLOW",
  };

  return {
    transactionId,
    decision,
    score: assessment.score,
    tier: assessment.tier as RiskTier,
    confidence: assessment.confidence,
    otpRequired: assessment.otpRequired,
    explanation: assessment.explanation,
    recommendation: assessment.recommendation ?? "",
    factors: assessment.factors.map((factor) => ({
      code: factor.code,
      label: factor.label,
      detail: factor.detail,
      contribution: factor.contribution,
    })),
    verificationStatus: riskStepUp ? "PENDING" : "NONE",
    actualAmount: Math.abs(Number(transaction.amount)),
    baseline: {
      avgAmount:
        assessment.baselineAvgAmount !== null ? Number(assessment.baselineAvgAmount) : null,
      p95Amount:
        assessment.baselineP95Amount !== null ? Number(assessment.baselineP95Amount) : null,
      medianAmount:
        assessment.baselineMedianAmount !== null
          ? Number(assessment.baselineMedianAmount)
          : null,
      sampleSize: assessment.baselineSampleSize,
    },
    socialEngineering: emptySe,
  };
}

/**
 * Customer cancelled from the SE pause UI — orchestrator BLOCKED → DENIED.
 */
export async function blockPausedTransaction(
  userId: string,
  transactionId: string
): Promise<{ ok: true; decision: "BLOCKED" } | { ok: false; error: string }> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      status: "PAUSED_FOR_VERIFICATION",
      account: { userId },
    },
    include: { riskAssessment: true },
  });

  if (!transaction) {
    return { ok: false, error: "Paused transaction not found." };
  }

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "DENIED" },
    }),
    ...(transaction.riskAssessment
      ? [
          prisma.riskAssessment.update({
            where: { id: transaction.riskAssessment.id },
            data: { verificationStatus: "REJECTED" },
          }),
        ]
      : []),
  ]);

  await recordFinEvent({
    type: "TRANSACTION_PAUSED_CALL_ACTIVE",
    severity: "MEDIUM",
    userId,
    transactionId,
    summary: `Transaction ${transactionId} blocked after social engineering pause — customer cancelled`,
    metadata: { decision: "BLOCKED" },
  });

  return { ok: true, decision: "BLOCKED" };
}
