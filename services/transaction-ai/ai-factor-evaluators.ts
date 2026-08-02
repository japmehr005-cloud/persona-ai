import type { RiskFactorResult } from "@/services/risk-engine/factor-evaluators";
import type { TransactionAiClassification } from "@/services/transaction-ai/client";

/** Hard cap so Transaction AI never dominates the rule-based engine. */
export const AI_RISK_CONTRIBUTION_CAP = 18;

const RARE_CATEGORY_THRESHOLD = 0.08;
const LOW_CONFIDENCE_THRESHOLD = 0.45;
const LARGE_AMOUNT_MULTIPLIER = 2.5;

export interface AiFactorContext {
  amount: number;
  avgAmount: number | null;
  aiClassification: TransactionAiClassification | null;
  /** Relative frequency of each app category in the user's baseline (sums ~1). */
  categoryFrequency: Record<string, number> | null;
}

/**
 * Additive Transaction Intelligence factors. Returns an empty list when the
 * sidecar is unavailable or signals are weak.
 */
export function evaluateTransactionAiFactors(ctx: AiFactorContext): RiskFactorResult[] {
  const { aiClassification } = ctx;
  if (!aiClassification) return [];

  const factors: RiskFactorResult[] = [];
  const freq = ctx.categoryFrequency ?? {};
  const categoryShare = freq[aiClassification.appCategory] ?? 0;
  const isRareCategory =
    Object.keys(freq).length > 0 && categoryShare < RARE_CATEGORY_THRESHOLD;
  const isLarge =
    ctx.avgAmount !== null &&
    ctx.avgAmount > 0 &&
    Math.abs(ctx.amount) >= ctx.avgAmount * LARGE_AMOUNT_MULTIPLIER;

  if (isRareCategory) {
    const contribution = Math.min(14, isLarge ? 14 : 8);
    factors.push({
      code: "AI_CATEGORY_DEVIATION",
      label: "AI category deviation",
      detail: `Transaction Intelligence classified this as ${aiClassification.category} (${aiClassification.appCategory}), which is rare in your usual spending mix (${(categoryShare * 100).toFixed(0)}% of recent spend).`,
      weight: contribution,
      contribution,
    });
  }

  if (aiClassification.confidence < LOW_CONFIDENCE_THRESHOLD && isLarge) {
    factors.push({
      code: "AI_CATEGORY_LOW_CONFIDENCE",
      label: "AI low-confidence category",
      detail: `Transaction Intelligence is only ${(aiClassification.confidence * 100).toFixed(0)}% confident about the category on a larger-than-usual amount.`,
      weight: 4,
      contribution: 4,
    });
  }

  return capAiFactors(factors);
}

export function capAiFactors(factors: RiskFactorResult[]): RiskFactorResult[] {
  const aiOnly = factors.filter((f) => f.code.startsWith("AI_"));
  const others = factors.filter((f) => !f.code.startsWith("AI_"));
  const total = aiOnly.reduce((sum, f) => sum + f.contribution, 0);
  if (total <= AI_RISK_CONTRIBUTION_CAP || total === 0) {
    return [...others, ...aiOnly];
  }
  const scale = AI_RISK_CONTRIBUTION_CAP / total;
  return [
    ...others,
    ...aiOnly.map((factor) => ({
      ...factor,
      contribution: Math.max(1, Math.round(factor.contribution * scale)),
      weight: Math.max(1, Math.round(factor.weight * scale)),
    })),
  ];
}

export function parseCategoryFrequency(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
