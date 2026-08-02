import { prisma } from "@/lib/prisma";
import type { GovSource, GovSubjectType, GovRiskLevel, Prisma } from "@prisma/client";
import { governmentIntelligenceProvider, type GovIntelCheckResult } from "@/services/government-intelligence/provider";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface GovernmentRiskResult {
  source: GovSource;
  subjectType: GovSubjectType;
  subjectValue: string;
  matched: boolean;
  riskLevel: GovRiskLevel;
  details: Record<string, unknown> | null;
  cached: boolean;
}

function toResult(
  source: GovSource,
  subjectType: GovSubjectType,
  subjectValue: string,
  cached: boolean,
  matched: boolean,
  riskLevel: GovRiskLevel,
  details: Prisma.JsonValue | Record<string, unknown> | null | undefined
): GovernmentRiskResult {
  return {
    source,
    subjectType,
    subjectValue,
    matched,
    riskLevel,
    details: (details as Record<string, unknown> | null) ?? null,
    cached,
  };
}

/**
 * Fronts every FRI/MNRL lookup with a `GovernmentRiskRecord` cache (24h TTL)
 * so repeated checks against the same phone/account/beneficiary don't
 * re-hit the provider on every transaction or login. Cache-miss results are
 * persisted immediately, making this the single entry point both the Risk
 * Engine and FIN should call instead of the raw provider.
 */
export async function checkGovernmentIntelligence(
  source: GovSource,
  subjectType: GovSubjectType,
  subjectValue: string
): Promise<GovernmentRiskResult> {
  const existing = await prisma.governmentRiskRecord.findUnique({
    where: { source_subjectType_subjectValue: { source, subjectType, subjectValue } },
  });

  if (existing && existing.expiresAt > new Date()) {
    return toResult(source, subjectType, subjectValue, true, existing.matched, existing.riskLevel, existing.details);
  }

  const checkFn = getProviderCheckFn(source, subjectType);
  const result: GovIntelCheckResult = await checkFn(subjectValue);

  const record = await prisma.governmentRiskRecord.upsert({
    where: { source_subjectType_subjectValue: { source, subjectType, subjectValue } },
    create: {
      source,
      subjectType,
      subjectValue,
      matched: result.matched,
      riskLevel: result.riskLevel,
      details: (result.details as Prisma.InputJsonValue) ?? undefined,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
    update: {
      matched: result.matched,
      riskLevel: result.riskLevel,
      details: (result.details as Prisma.InputJsonValue) ?? undefined,
      checkedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
  });

  return toResult(source, subjectType, subjectValue, false, record.matched, record.riskLevel, record.details);
}

function getProviderCheckFn(
  source: GovSource,
  subjectType: GovSubjectType
): (value: string) => Promise<GovIntelCheckResult> {
  // MNRL only ever checks phone numbers; FRI covers accounts/beneficiaries
  // (and, in a real integration, could also flag phone numbers used in
  // fraud rings — routed through the same provider method for now).
  if (subjectType === "PHONE") {
    return governmentIntelligenceProvider.checkPhone.bind(governmentIntelligenceProvider);
  }
  if (subjectType === "ACCOUNT") {
    return governmentIntelligenceProvider.checkAccount.bind(governmentIntelligenceProvider);
  }
  return governmentIntelligenceProvider.checkBeneficiary.bind(governmentIntelligenceProvider);
}
