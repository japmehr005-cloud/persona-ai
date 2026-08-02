import type {
  SocialEngineeringEvaluation,
  SocialEngineeringSignal,
  SocialEngineeringSnapshot,
} from "@/services/social-engineering/types";

function buildExplanation(activeSignals: SocialEngineeringSignal[]): string {
  if (activeSignals.length === 0) {
    return "No social engineering signals were detected for this transaction.";
  }

  const labels = activeSignals.map((signal) => signal.label.toLowerCase()).join(", ");
  return `Potential social engineering activity detected: ${labels}. Scammers often keep victims on a live call while guiding them through a transfer. This transaction has been paused for your protection.`;
}

/**
 * Pure evaluation over a previously collected signal snapshot.
 * Does NOT read or write risk scores.
 */
export function evaluateSocialEngineering(
  snapshot: SocialEngineeringSnapshot
): SocialEngineeringEvaluation {
  const activeSignals = snapshot.signals.filter((signal) => signal.active);
  const triggered = activeSignals.length > 0;

  return {
    triggered,
    signals: snapshot.signals,
    activeSignals,
    explanation: buildExplanation(activeSignals),
    recommendedAction: triggered ? "PAUSE_FOR_VERIFICATION" : "ALLOW",
  };
}
