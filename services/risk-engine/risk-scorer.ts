import type { ContextBundle } from "@/services/risk-engine/context-bundle";
import {
  evaluateAccessibilityAbuse,
  evaluateAmountDeviation,
  evaluateBehaviorDeviation,
  evaluateDeviceIntegrity,
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
  evaluateVelocity,
  evaluateWeekdayAnomaly,
  type RiskFactorResult,
} from "@/services/risk-engine/factor-evaluators";
import { buildExplanation } from "@/services/explainability/explanation-builder";
import {
  isVerificationRequired,
  tierForScore,
  type RiskThresholds,
  type RiskTier,
} from "@/services/risk-engine/threshold-policy";

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
  ].filter((factor): factor is RiskFactorResult => factor !== null);

  const score = Math.min(
    MAX_SCORE,
    factors.reduce((sum, factor) => sum + factor.contribution, 0)
  );
  const tier = tierForScore(score, thresholds);
  const otpRequired = isVerificationRequired(score, thresholds);
  const confidence = computeConfidence(context.sampleSize, factors.length);
  const explanation = buildExplanation(factors, date);

  return { score, tier, otpRequired, confidence, explanation, factors };
}
