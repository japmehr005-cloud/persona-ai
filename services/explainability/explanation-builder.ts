import { format } from "date-fns";

import type { RiskFactorResult } from "@/services/risk-engine/factor-evaluators";

const TOP_FACTOR_LIMIT = 3;

const FRAGMENT_BUILDERS: Record<string, (factor: RiskFactorResult, date: Date) => string> = {
  AMOUNT_DEVIATION: (factor) => factor.detail.replace(/^This amount /, "").replace(/\.$/, ""),
  NEW_MERCHANT: () => "originates from a merchant you haven't used before",
  NEW_DEVICE: () => "was made from an unrecognized device",
  LOCATION_ANOMALY: () => "appears to originate far from your usual locations",
  TIME_ANOMALY: (_factor, date) => `occurred outside your usual active hours (${format(date, "h:mm a")})`,
  VELOCITY: (factor) => factor.detail.replace(/\.$/, "").replace(/^/, "follows a burst of activity — "),
  SIMULATED_CALL: () => "occurred while a suspicious call signal was active",
  SIMULATED_SMS: () => "occurred alongside an SMS matching known phishing patterns",
};

/**
 * Maps the top contributing risk factors to a single plain-language
 * sentence, e.g. "This transfer is 4.2x your typical amount, was made from
 * an unrecognized device, and occurred outside your usual active hours
 * (2:14 AM)."
 */
export function buildExplanation(factors: RiskFactorResult[], date: Date): string {
  if (factors.length === 0) {
    return "This transaction is consistent with your typical behavior and was approved automatically.";
  }

  const topFactors = [...factors]
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, TOP_FACTOR_LIMIT);

  const fragments = topFactors.map((factor) => {
    const builder = FRAGMENT_BUILDERS[factor.code];
    return builder ? builder(factor, date) : factor.detail.toLowerCase();
  });

  return `This transaction ${joinFragments(fragments)}.`;
}

function joinFragments(fragments: string[]): string {
  if (fragments.length === 1) return fragments[0];
  if (fragments.length === 2) return `${fragments[0]}, and ${fragments[1]}`;
  return `${fragments.slice(0, -1).join(", ")}, and ${fragments[fragments.length - 1]}`;
}
