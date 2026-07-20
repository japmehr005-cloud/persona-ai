import { RISK_TIER_THRESHOLDS } from "@/lib/constants";

export type RiskTier = "LOW" | "MEDIUM" | "HIGH";

export function tierForScore(score: number): RiskTier {
  if (score <= RISK_TIER_THRESHOLDS.LOW_MAX) return "LOW";
  if (score <= RISK_TIER_THRESHOLDS.MEDIUM_MAX) return "MEDIUM";
  return "HIGH";
}

export function isOtpRequired(score: number, otpThreshold: number): boolean {
  return score >= otpThreshold;
}
