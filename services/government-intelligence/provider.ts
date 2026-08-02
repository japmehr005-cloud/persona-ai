import { createHash } from "crypto";

export type GovRiskLevel = "CLEAR" | "LOW" | "ELEVATED" | "HIGH";

export interface GovIntelCheckResult {
  matched: boolean;
  riskLevel: GovRiskLevel;
  details?: Record<string, unknown>;
}

/**
 * Abstraction every government-intelligence lookup goes through. The
 * hackathon ships {@link MockGovernmentIntelligenceProvider}; swapping in a
 * real FRI/MNRL integration later means implementing this interface once,
 * with zero changes to `fri-service.ts`/`mnrl-service.ts` or their callers
 * (FIN, the Risk Engine) — see DEPLOYMENT-QUALITY-REQUIREMENTS.
 */
export interface GovernmentIntelligenceProvider {
  checkPhone(phoneNumber: string): Promise<GovIntelCheckResult>;
  checkAccount(accountIdentifier: string): Promise<GovIntelCheckResult>;
  checkBeneficiary(beneficiaryName: string): Promise<GovIntelCheckResult>;
}

/** Deterministic, demoable "known-bad" seed values so judges can reliably
 * trigger a real hit instead of relying on random chance. */
const KNOWN_REVOKED_PHONE_SUFFIXES = ["0000", "1313"];
const KNOWN_FRAUD_BENEFICIARIES = new Set([
  "rapid mule transfers",
  "quickcash mule network",
  "offshore holdings ltd",
]);
const KNOWN_FRAUD_ACCOUNT_PREFIXES = ["MULE", "FRAUD", "SCAM"];

function hashToUnitInterval(value: string): number {
  const digest = createHash("sha256").update(value.toLowerCase().trim()).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

/**
 * Deterministic mock provider: a small set of seeded "known-bad" subjects
 * always match (for reliable demo triggers), and every other subject gets a
 * low, hash-derived background risk so results are stable across repeated
 * lookups but not obviously random.
 */
export class MockGovernmentIntelligenceProvider implements GovernmentIntelligenceProvider {
  async checkPhone(phoneNumber: string): Promise<GovIntelCheckResult> {
    const digits = phoneNumber.replace(/\D/g, "");
    if (KNOWN_REVOKED_PHONE_SUFFIXES.some((suffix) => digits.endsWith(suffix))) {
      return {
        matched: true,
        riskLevel: "HIGH",
        details: { reason: "Number appears on the Mobile Number Revocation List (MNRL)." },
      };
    }

    const backgroundRisk = hashToUnitInterval(digits);
    if (backgroundRisk > 0.97) {
      return { matched: false, riskLevel: "LOW", details: { reason: "Minor irregularities on file." } };
    }
    return { matched: false, riskLevel: "CLEAR" };
  }

  async checkAccount(accountIdentifier: string): Promise<GovIntelCheckResult> {
    const upper = accountIdentifier.toUpperCase();
    if (KNOWN_FRAUD_ACCOUNT_PREFIXES.some((prefix) => upper.includes(prefix))) {
      return {
        matched: true,
        riskLevel: "HIGH",
        details: { reason: "Account identifier matches a known Financial Fraud Risk Indicator (FRI) pattern." },
      };
    }

    const backgroundRisk = hashToUnitInterval(accountIdentifier);
    if (backgroundRisk > 0.95) {
      return { matched: false, riskLevel: "LOW", details: { reason: "Elevated background risk score." } };
    }
    return { matched: false, riskLevel: "CLEAR" };
  }

  async checkBeneficiary(beneficiaryName: string): Promise<GovIntelCheckResult> {
    if (KNOWN_FRAUD_BENEFICIARIES.has(beneficiaryName.toLowerCase().trim())) {
      return {
        matched: true,
        riskLevel: "HIGH",
        details: { reason: "Beneficiary matches a known Financial Fraud Risk Indicator (FRI) entity." },
      };
    }

    const backgroundRisk = hashToUnitInterval(beneficiaryName);
    if (backgroundRisk > 0.9) {
      return { matched: false, riskLevel: "ELEVATED", details: { reason: "Beneficiary has an elevated risk profile." } };
    }
    return { matched: false, riskLevel: "CLEAR" };
  }
}

export const governmentIntelligenceProvider: GovernmentIntelligenceProvider =
  new MockGovernmentIntelligenceProvider();
