import { checkGovernmentIntelligence, type GovernmentRiskResult } from "@/services/government-intelligence/government-risk-cache";

/**
 * Financial Fraud Risk Indicator (FRI) — checks whether an account
 * identifier or beneficiary name is known to government/industry fraud
 * intelligence. Backed by {@link checkGovernmentIntelligence}'s cache.
 */
export async function checkFriForAccount(accountIdentifier: string): Promise<GovernmentRiskResult> {
  return checkGovernmentIntelligence("FRI", "ACCOUNT", accountIdentifier);
}

export async function checkFriForBeneficiary(beneficiaryName: string): Promise<GovernmentRiskResult> {
  return checkGovernmentIntelligence("FRI", "BENEFICIARY", beneficiaryName);
}
