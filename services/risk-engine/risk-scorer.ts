import type { ContextBundle } from "@/services/risk-engine/context-bundle";
import {
  evaluateAccessibilityAbuse,
  evaluateAmountDeviation,
  evaluateBehaviorDeviation,
  evaluateDeviceIntegrity,
  evaluateDeviceSimilarity,
  evaluateLocationAnomaly,
  evaluateMultipleBeneficiaries,
  evaluateNewDevice,
  evaluateNewMerchant,
  evaluateRapidBalanceDrain,
  evaluateRecipientFamiliarity,
  evaluateRemoteAccess,
  evaluateRepeatedOtpRequests,
  evaluateScreenShare,
  evaluateSimulatedCall,
  evaluateSimulatedSms,
  evaluateTimeAnomaly,
  evaluateUntrustedRealLocation,
  evaluateVelocity,
  evaluateWeekdayAnomaly,
  type RiskFactorResult,
} from "@/services/risk-engine/factor-evaluators";
import { evaluateGovernmentIntelligence } from "@/services/government-intelligence/government-risk-factor";
import { buildExplanation } from "@/services/explainability/explanation-builder";
import {
  isVerificationRequired,
  tierForScore,
  type RiskThresholds,
  type RiskTier,
} from "@/services/risk-engine/threshold-policy";
import { evaluateTransactionAiFactors } from "@/services/transaction-ai/ai-factor-evaluators";

export interface RiskScoreInput {
  amount: number;
  date: Date;
  thresholds: RiskThresholds;
  context: ContextBundle;
}

export interface RiskScoreResult {
  score: number;
  tier: RiskTier;
  /** True once the score reaches the user's high-risk threshold (HIGH or
   * CRITICAL). This gates the High-Risk Verification flow, which itself
   * gates CB-OTP — it no longer means "issue an OTP immediately". */
  otpRequired: boolean;
  /** Model confidence (0-100) in this specific assessment, derived from
   * behavioral-baseline sample size and how many independent factors
   * corroborate each other. Not user-editable. */
  confidence: number;
  explanation: string;
  factors: RiskFactorResult[];
  /** Plain-language recommended action for the Explainable AI panel — never
   * a bare "Transaction Blocked"; always says why and what happens next. */
  recommendation: string;
  /** Phase 9 — snapshot sub-totals for the explainability panel, persisted
   * verbatim onto `RiskAssessment` so historical assessments stay accurate
   * even as the live FIN/government-intelligence signals keep changing. */
  finRiskScore: number;
  governmentRiskScore: number;
  deviceSimilarityScore: number;
  /** Additive Transaction Intelligence contribution (capped). */
  aiRiskScore: number;
}

const MAX_SCORE = 100;
const CONFIDENCE_BASE = 50;
const CONFIDENCE_BASELINE_CAP = 35;
const CONFIDENCE_CORROBORATION_CAP = 15;
/** Sample size at which the baseline-strength component of confidence
 * saturates — comfortably above the 30-transaction minimum needed for a
 * behavioral profile to exist at all. */
const CONFIDENCE_BASELINE_SATURATION = 105;

/**
 * Confidence reflects how much the engine actually knows about this
 * customer (a thin/no behavioral profile means more guesswork) and how
 * many independent signals agree with each other (a single triggered
 * factor is less conclusive than five that corroborate the same story).
 */
function computeConfidence(sampleSize: number, factorCount: number): number {
  const baselineComponent = Math.min(
    CONFIDENCE_BASELINE_CAP,
    Math.round((sampleSize / CONFIDENCE_BASELINE_SATURATION) * CONFIDENCE_BASELINE_CAP)
  );
  const corroborationComponent = Math.min(CONFIDENCE_CORROBORATION_CAP, factorCount * 4);
  return Math.min(99, CONFIDENCE_BASE + baselineComponent + corroborationComponent);
}

/**
 * Deterministic, explainable weighted-factor risk model. Each evaluator
 * inspects one dimension of the transaction against the user's behavioral
 * baseline and context, contributing 0 or more points. The sum is capped at
 * 100 and mapped to one of four tiers (LOW/MEDIUM/HIGH/CRITICAL) using the
 * caller's per-user thresholds.
 */
export function scoreTransaction(input: RiskScoreInput): RiskScoreResult {
  const { amount, date, context, thresholds } = input;

  const factors = [
    evaluateAmountDeviation({
      amount,
      avgAmount: context.avgAmount,
      p95Amount: context.p95Amount,
      stdDevAmount: context.stdDevAmount,
    }),
    evaluateNewMerchant(context.hasUsedMerchantBefore),
    evaluateRecipientFamiliarity({
      beneficiary: context.beneficiary,
      isFirstTimeBeneficiary: context.isFirstTimeBeneficiary,
      isDormantBeneficiary: context.isDormantBeneficiary,
    }),
    evaluateNewDevice(context.deviceTrusted),
    evaluateDeviceIntegrity(context.deviceIntegritySubtype),
    evaluateLocationAnomaly(context.locationSeverity),
    evaluateTimeAnomaly(date.getHours(), context.activeHours),
    evaluateWeekdayAnomaly(date.getDay(), context.activeDays),
    evaluateVelocity(context.txCountLastHour),
    evaluateRapidBalanceDrain(context.txAmountLastDay, context.accountBalance),
    evaluateRepeatedOtpRequests(context.otpRequestCountLastHour),
    evaluateMultipleBeneficiaries(context.distinctBeneficiariesLastDay),
    evaluateSimulatedCall(context.callSignalActive, context.callSignalSubtype),
    evaluateSimulatedSms(context.smsSignalActive, context.smsSignalSubtype),
    evaluateScreenShare(context.screenShareActive),
    evaluateRemoteAccess(context.remoteAccessActive),
    evaluateAccessibilityAbuse(context.accessibilityAbuseActive),
    evaluateBehaviorDeviation({
      amount,
      medianAmount: context.medianAmount,
      hasUsedMerchantBefore: context.hasUsedMerchantBefore,
    }),
    // Fraud Intelligence Network — already-resolved async lookups from
    // `buildContextBundle` (open reports / cluster matches), plus the
    // synchronous device-similarity and government-intelligence evaluators.
    ...context.finFactors,
    evaluateDeviceSimilarity(context.deviceSimilarUserCount),
    evaluateGovernmentIntelligence(
      context.governmentRiskLevel,
      context.governmentRiskReason,
      context.governmentRiskSource
    ),
    evaluateUntrustedRealLocation(context.realLocationTrusted, context.realLocationCity),
    // Phase 2 AI — additive only; capped inside evaluateTransactionAiFactors
    ...evaluateTransactionAiFactors({
      amount,
      avgAmount: context.avgAmount,
      aiClassification: context.aiClassification,
      categoryFrequency: context.categoryFrequency,
    }),
  ].filter((factor): factor is RiskFactorResult => factor !== null);

  const score = Math.min(
    MAX_SCORE,
    factors.reduce((sum, factor) => sum + factor.contribution, 0)
  );
  const tier = tierForScore(score, thresholds);
  const otpRequired = isVerificationRequired(score, thresholds);
  const confidence = computeConfidence(context.sampleSize, factors.length);
  const explanation = buildExplanation(factors, date);
  const recommendation = buildRecommendation(tier, otpRequired, factors);

  const finRiskScore = sumContributions(factors, (code) => code.startsWith("FIN_"));
  const governmentRiskScore = sumContributions(factors, (code) => code.startsWith("GOVERNMENT_INTELLIGENCE_"));
  const deviceSimilarityScore = sumContributions(factors, (code) => code === "FIN_DEVICE_SIMILARITY");
  const aiRiskScore = sumContributions(factors, (code) => code.startsWith("AI_"));

  return {
    score,
    tier,
    otpRequired,
    confidence,
    explanation,
    factors,
    recommendation,
    finRiskScore,
    governmentRiskScore,
    deviceSimilarityScore,
    aiRiskScore,
  };
}

function sumContributions(factors: RiskFactorResult[], match: (code: string) => boolean): number {
  return factors.filter((factor) => match(factor.code)).reduce((sum, factor) => sum + factor.contribution, 0);
}

/**
 * Per the Explainable AI rule: never a bare "Transaction Blocked" — always a
 * specific recommended action, and CRITICAL/government-intelligence hits are
 * called out explicitly rather than folded into a generic "high risk" line.
 */
function buildRecommendation(tier: RiskTier, otpRequired: boolean, factors: RiskFactorResult[]): string {
  const hasGovernmentHit = factors.some((factor) => factor.code.startsWith("GOVERNMENT_INTELLIGENCE_"));
  const hasFinClusterMatch = factors.some(
    (factor) => factor.code === "FIN_DEVICE_CLUSTER_MATCH" || factor.code === "FIN_BENEFICIARY_CLUSTER_MATCH"
  );

  if (tier === "CRITICAL") {
    if (hasGovernmentHit) {
      return "Block this transaction and escalate to investigation — the recipient or account is flagged by government fraud intelligence (FRI/MNRL).";
    }
    if (hasFinClusterMatch) {
      return "Block this transaction and escalate to investigation — this device or recipient is linked to a known fraud cluster.";
    }
    return "Block this transaction and escalate to investigation immediately.";
  }

  if (otpRequired) {
    return "Require step-up verification (biometric, authenticator, or Context-Bound OTP) before this transaction can proceed.";
  }

  if (tier === "MEDIUM") {
    return "Approve, but continue monitoring — several factors are outside this customer's typical pattern.";
  }

  return "Approve — consistent with this customer's established behavioral baseline.";
}
