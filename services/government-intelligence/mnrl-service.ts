import { checkGovernmentIntelligence, type GovernmentRiskResult } from "@/services/government-intelligence/government-risk-cache";

/**
 * Mobile Number Revocation List (MNRL) — checks whether a phone number has
 * been revoked/reassigned by the telecom regulator, a strong signal for
 * SIM-swap and OTP-interception fraud. Backed by
 * {@link checkGovernmentIntelligence}'s cache.
 */
export async function checkMnrlForPhone(phoneNumber: string): Promise<GovernmentRiskResult> {
  return checkGovernmentIntelligence("MNRL", "PHONE", phoneNumber);
}
