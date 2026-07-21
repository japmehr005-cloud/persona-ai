import { prisma } from "@/lib/prisma";
import { clampRiskThresholds } from "@/services/risk-engine/threshold-policy";

export interface UpdateRiskEngineSettingsInput {
  adaptiveLearningEnabled: boolean;
  mediumRiskThreshold: number;
  highRiskThreshold: number;
  riskEngineDemoMode: boolean;
}

/**
 * Persists a user's Risk Engine preferences. Thresholds are always
 * re-clamped server-side (never trusting the client-submitted numbers
 * directly) so a customer can tune sensitivity without ever disabling
 * step-up verification or raising their own threshold into CRITICAL
 * territory — see `clampRiskThresholds`.
 */
export async function updateRiskEngineSettings(
  userId: string,
  input: UpdateRiskEngineSettingsInput
): Promise<{ mediumRiskThreshold: number; highRiskThreshold: number }> {
  const thresholds = clampRiskThresholds(input);

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      adaptiveLearningEnabled: input.adaptiveLearningEnabled,
      riskEngineDemoMode: input.riskEngineDemoMode,
      mediumRiskThreshold: thresholds.mediumRiskThreshold,
      highRiskThreshold: thresholds.highRiskThreshold,
    },
    update: {
      adaptiveLearningEnabled: input.adaptiveLearningEnabled,
      riskEngineDemoMode: input.riskEngineDemoMode,
      mediumRiskThreshold: thresholds.mediumRiskThreshold,
      highRiskThreshold: thresholds.highRiskThreshold,
    },
  });

  return thresholds;
}
