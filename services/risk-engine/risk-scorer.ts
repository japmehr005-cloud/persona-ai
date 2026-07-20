import type { ContextBundle } from "@/services/risk-engine/context-bundle";
import {
  evaluateAmountDeviation,
  evaluateLocationAnomaly,
  evaluateNewDevice,
  evaluateNewMerchant,
  evaluateSimulatedCall,
  evaluateSimulatedSms,
  evaluateTimeAnomaly,
  evaluateVelocity,
  type RiskFactorResult,
} from "@/services/risk-engine/factor-evaluators";
import { buildExplanation } from "@/services/explainability/explanation-builder";
import { isOtpRequired, tierForScore, type RiskTier } from "@/services/risk-engine/threshold-policy";

export interface RiskScoreInput {
  amount: number;
  date: Date;
  otpThreshold: number;
  context: ContextBundle;
}

export interface RiskScoreResult {
  score: number;
  tier: RiskTier;
  otpRequired: boolean;
  explanation: string;
  factors: RiskFactorResult[];
}

const MAX_SCORE = 100;

/**
 * Deterministic, explainable weighted-factor risk model. Each evaluator
 * inspects one dimension of the transaction against the user's behavioral
 * baseline and context, contributing 0 or more points. The sum is capped at
 * 100 and mapped to a tier + step-up authentication requirement.
 */
export function scoreTransaction(input: RiskScoreInput): RiskScoreResult {
  const { amount, date, context } = input;

  const factors = [
    evaluateAmountDeviation({
      amount,
      avgAmount: context.avgAmount,
      p95Amount: context.p95Amount,
      stdDevAmount: context.stdDevAmount,
    }),
    evaluateNewMerchant(context.hasUsedMerchantBefore),
    evaluateNewDevice(context.deviceTrusted),
    evaluateLocationAnomaly(context.locationFlagged),
    evaluateTimeAnomaly(date.getHours(), context.activeHours),
    evaluateVelocity(context.txCountLastHour),
    evaluateSimulatedCall(context.callSignalActive),
    evaluateSimulatedSms(context.smsSignalActive),
  ].filter((factor): factor is RiskFactorResult => factor !== null);

  const score = Math.min(
    MAX_SCORE,
    factors.reduce((sum, factor) => sum + factor.contribution, 0)
  );
  const tier = tierForScore(score);
  const otpRequired = isOtpRequired(score, input.otpThreshold);
  const explanation = buildExplanation(factors, date);

  return { score, tier, otpRequired, explanation, factors };
}
