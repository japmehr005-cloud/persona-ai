import { prisma } from "@/lib/prisma";
import type { GovRiskLevel, GovSource } from "@prisma/client";

export interface GovernmentIntelligenceHit {
  id: string;
  source: GovSource;
  subjectType: string;
  subjectValue: string;
  riskLevel: GovRiskLevel;
  details: Record<string, unknown> | null;
  checkedAt: Date;
}

export interface GovernmentIntelligenceOverview {
  totalChecks: number;
  totalMatched: number;
  friMatched: number;
  mnrlMatched: number;
  riskLevelBreakdown: Record<GovRiskLevel, number>;
  recentHits: GovernmentIntelligenceHit[];
}

const RECENT_HITS_LIMIT = 20;

/**
 * The Admin SOC's Government Intelligence panel — reads the
 * `GovernmentRiskRecord` cache directly (every FRI/MNRL lookup the Risk
 * Engine and FIN have ever performed) rather than calling the provider
 * live, since the cache *is* the system of record for "what government
 * intelligence do we currently hold" — matched or not.
 */
export async function getGovernmentIntelligenceOverview(): Promise<GovernmentIntelligenceOverview> {
  const [totalChecks, matchedRecords, recentHits] = await Promise.all([
    prisma.governmentRiskRecord.count(),
    prisma.governmentRiskRecord.findMany({ where: { matched: true }, select: { source: true, riskLevel: true } }),
    prisma.governmentRiskRecord.findMany({
      where: { matched: true },
      orderBy: { checkedAt: "desc" },
      take: RECENT_HITS_LIMIT,
    }),
  ]);

  const riskLevelBreakdown: Record<GovRiskLevel, number> = { CLEAR: 0, LOW: 0, ELEVATED: 0, HIGH: 0 };
  let friMatched = 0;
  let mnrlMatched = 0;

  for (const record of matchedRecords) {
    riskLevelBreakdown[record.riskLevel] += 1;
    if (record.source === "FRI") friMatched += 1;
    if (record.source === "MNRL") mnrlMatched += 1;
  }

  return {
    totalChecks,
    totalMatched: matchedRecords.length,
    friMatched,
    mnrlMatched,
    riskLevelBreakdown,
    recentHits: recentHits.map((hit) => ({
      id: hit.id,
      source: hit.source,
      subjectType: hit.subjectType,
      subjectValue: hit.subjectValue,
      riskLevel: hit.riskLevel,
      details: (hit.details as Record<string, unknown> | null) ?? null,
      checkedAt: hit.checkedAt,
    })),
  };
}
