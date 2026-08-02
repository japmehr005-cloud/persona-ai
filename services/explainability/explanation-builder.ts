import { format } from "date-fns";

import type { RiskFactorResult } from "@/services/risk-engine/factor-evaluators";

const TOP_FACTOR_LIMIT = 3;

const FRAGMENT_BUILDERS: Record<string, (factor: RiskFactorResult, date: Date) => string> = {
  AMOUNT_DEVIATION: (factor) => factor.detail.replace(/^This amount /, "").replace(/\.$/, ""),
  NEW_MERCHANT: () => "originates from a merchant you haven't used before",
  NEW_RECIPIENT: (factor) => factor.detail.replace(/^You haven't /, "").replace(/\.$/, ""),
  DORMANT_RECIPIENT: (factor) => factor.detail.replace(/^You haven't /, "").replace(/\.$/, ""),
  NEW_DEVICE: () => "was made from an unrecognized device",
  DEVICE_INTEGRITY_ROOTED: () => "originated from a device reporting root/jailbreak access",
  DEVICE_INTEGRITY_EMULATOR: () => "originated from an emulated device rather than physical hardware",
  DEVICE_INTEGRITY_FINGERPRINT_MISMATCH: () => "came from a device whose fingerprint changed mid-session",
  LOCATION_ANOMALY: () => "appears to originate far from your usual locations",
  LOCATION_IMPOSSIBLE_TRAVEL: () => "originates from a location that couldn't be reached from your last known location in time",
  LOCATION_NEW_CITY: () => "appears to originate far from your usual locations",
  LOCATION_NEW_REGION: () => "originates from a network region you haven't used before",
  TIME_ANOMALY: (_factor, date) => `occurred outside your usual active hours (${format(date, "h:mm a")})`,
  WEEKDAY_ANOMALY: (factor) => factor.detail.replace(/^You rarely /, "").replace(/\.$/, ""),
  VELOCITY: (factor) => factor.detail.replace(/\.$/, "").replace(/^/, "follows a burst of activity — "),
  RAPID_BALANCE_DRAIN: (factor) => factor.detail.replace(/\.$/, "").replace(/^/, ""),
  REPEATED_OTP_REQUESTS: (factor) => factor.detail.replace(/\.$/, ""),
  MULTIPLE_BENEFICIARIES: (factor) => factor.detail.replace(/^You've /, "").replace(/\.$/, ""),
  SIMULATED_CALL: () => "occurred while a suspicious call signal was active",
  SIMULATED_CALL_UNKNOWN_CALLER: () => "occurred while a call from an unknown caller was active",
  SIMULATED_SMS: () => "occurred alongside an SMS matching known phishing patterns",
  SIMULATED_SMS_SCAM_KEYWORDS: () => "occurred alongside an SMS containing known scam keywords",
  SCREEN_SHARE: () => "occurred while screen sharing was active on the device",
  REMOTE_ACCESS: () => "occurred while remote-control software was running on the device",
  ACCESSIBILITY_ABUSE: () => "occurred alongside accessibility-service usage consistent with fraud automation",
  BEHAVIOR_DEVIATION: (factor) => factor.detail.replace(/^This is /, "is ").replace(/\.$/, ""),
  FIN_OPEN_FRAUD_REPORT: () => "was made on an account with an open fraud report under review",
  FIN_DEVICE_CLUSTER_MATCH: () => "was made from a device another customer has reported as suspicious",
  FIN_BENEFICIARY_CLUSTER_MATCH: () => "was sent to a recipient another customer has reported as suspicious",
  FIN_DEVICE_SIMILARITY: (factor) => factor.detail.replace(/^This device /, "was made from a device that ").replace(/\.$/, ""),
  GOVERNMENT_INTELLIGENCE_LOW: () => "involves a party with a minor government fraud-intelligence flag",
  GOVERNMENT_INTELLIGENCE_ELEVATED: () => "involves a party flagged with elevated risk by government fraud intelligence",
  GOVERNMENT_INTELLIGENCE_HIGH: () => "involves a party flagged by government fraud intelligence (FRI/MNRL)",
  REAL_LOCATION_UNTRUSTED: () => "originated from a sign-in location we haven't yet confirmed as trusted",
  AI_CATEGORY_DEVIATION: () =>
    "was classified by Transaction Intelligence into a spending category that is rare for you",
  AI_CATEGORY_LOW_CONFIDENCE: () =>
    "has an uncertain Transaction Intelligence category on a larger-than-usual amount",
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
