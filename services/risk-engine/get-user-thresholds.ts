import { prisma } from "@/lib/prisma";
import { clampRiskThresholds, DEFAULT_RISK_THRESHOLDS, type RiskThresholds } from "@/services/risk-engine/threshold-policy";

/**
 * Reads a user's configured risk-tier thresholds (Settings → Risk Engine),
 * falling back to the product defaults for users who haven't created a
 * `UserSettings` row yet. Always re-clamps on read as a defense-in-depth
 * measure, in case bounds are tightened in a future release.
 */
export async function getUserRiskThresholds(userId: string): Promise<RiskThresholds> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { mediumRiskThreshold: true, highRiskThreshold: true },
  });

  if (!settings) return DEFAULT_RISK_THRESHOLDS;

  return clampRiskThresholds({
    mediumRiskThreshold: settings.mediumRiskThreshold,
    highRiskThreshold: settings.highRiskThreshold,
  });
}
