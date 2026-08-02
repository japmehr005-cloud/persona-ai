import type { GovRiskLevel } from "@prisma/client";

export interface GovernmentRiskFactorResult {
  code: string;
  label: string;
  detail: string;
  weight: number;
  contribution: number;
}

const RISK_LEVEL_WEIGHT: Record<Exclude<GovRiskLevel, "CLEAR">, number> = {
  LOW: 8,
  ELEVATED: 18,
  HIGH: 35,
};

/**
 * Pure risk-engine evaluator for government intelligence (FRI/MNRL). Takes
 * the *already-resolved* risk level from `ContextBundle` (resolved
 * asynchronously in `buildContextBundle` via the government-risk cache) so
 * it can slot into `factor-evaluators.ts`'s synchronous evaluator pipeline
 * exactly like every other factor.
 */
export function evaluateGovernmentIntelligence(
  riskLevel: GovRiskLevel | null,
  reason: string | null,
  source: "FRI" | "MNRL" | null
): GovernmentRiskFactorResult | null {
  if (!riskLevel || riskLevel === "CLEAR") return null;

  const weight = RISK_LEVEL_WEIGHT[riskLevel];
  const sourceLabel = source === "MNRL" ? "Mobile Number Revocation List" : "Financial Fraud Risk Indicator";

  return {
    code: `GOVERNMENT_INTELLIGENCE_${riskLevel}`,
    label: source === "MNRL" ? "Mobile number flagged by regulator" : "Government fraud intelligence hit",
    detail: reason ?? `This transaction involves a party flagged by the ${sourceLabel} (${source ?? "government"}).`,
    weight,
    contribution: weight,
  };
}
