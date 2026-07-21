import {
  CRITICAL_RISK_MIN,
  DEFAULT_HIGH_RISK_THRESHOLD,
  DEFAULT_MEDIUM_RISK_THRESHOLD,
  RISK_THRESHOLD_BOUNDS,
} from "@/lib/constants";

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskThresholds {
  mediumRiskThreshold: number;
  highRiskThreshold: number;
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  mediumRiskThreshold: DEFAULT_MEDIUM_RISK_THRESHOLD,
  highRiskThreshold: DEFAULT_HIGH_RISK_THRESHOLD,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Server-side clamp applied whenever a user's risk thresholds are read or
 * written, so a customer can tune sensitivity (Settings → Risk Engine)
 * without ever being able to disable step-up verification or push their own
 * threshold into CRITICAL territory. `mediumRiskThreshold` is clamped first,
 * then `highRiskThreshold` is clamped to stay strictly above it.
 */
export function clampRiskThresholds(input: Partial<RiskThresholds>): RiskThresholds {
  const mediumRiskThreshold = clamp(
    input.mediumRiskThreshold ?? DEFAULT_RISK_THRESHOLDS.mediumRiskThreshold,
    RISK_THRESHOLD_BOUNDS.medium.min,
    RISK_THRESHOLD_BOUNDS.medium.max
  );
  const highRiskThreshold = clamp(
    input.highRiskThreshold ?? DEFAULT_RISK_THRESHOLDS.highRiskThreshold,
    Math.max(RISK_THRESHOLD_BOUNDS.high.min, mediumRiskThreshold + 1),
    RISK_THRESHOLD_BOUNDS.high.max
  );
  return { mediumRiskThreshold, highRiskThreshold };
}

/**
 * Maps a 0-100 risk score to one of four tiers using the caller's
 * (already-clamped) per-user thresholds. CRITICAL's floor is fixed at
 * `CRITICAL_RISK_MIN` and is never user-adjustable.
 */
export function tierForScore(score: number, thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS): RiskTier {
  if (score < thresholds.mediumRiskThreshold) return "LOW";
  if (score < thresholds.highRiskThreshold) return "MEDIUM";
  if (score < CRITICAL_RISK_MIN) return "HIGH";
  return "CRITICAL";
}

/**
 * HIGH/CRITICAL transactions never execute immediately — they open a
 * High-Risk Verification context session (Cancel Transaction / Verify
 * Identity) instead, with CB-OTP only issued after identity is verified.
 */
export function isVerificationRequired(score: number, thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS): boolean {
  return score >= thresholds.highRiskThreshold;
}
