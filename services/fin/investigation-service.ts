import { prisma } from "@/lib/prisma";
import type { ClusterRiskLevel, FraudReportStatus, FraudReportType, GovRiskLevel, GovSource } from "@prisma/client";

export interface FraudReportEvidence {
  transaction: { id: string; merchant: string; amount: string; date: Date } | null;
  session: {
    id: string;
    city: string | null;
    country: string | null;
    ipAddress: string | null;
    startedAt: Date;
    riskScore: number | null;
  } | null;
  device: {
    id: string;
    label: string;
    trusted: boolean;
    fingerprintHash: string;
    similarityKey: string | null;
  } | null;
}

export interface RelatedFraudReport {
  id: string;
  type: FraudReportType;
  status: FraudReportStatus;
  reporterName: string;
  createdAt: Date;
  linkReason: "Same device" | "Same recipient";
}

export interface ClusterMembership {
  id: string;
  label: string;
  riskLevel: ClusterRiskLevel;
  memberCount: number;
}

export interface GovernmentHitSummary {
  source: GovSource;
  riskLevel: GovRiskLevel;
  subjectValue: string;
}

export interface FraudReportDetail {
  id: string;
  type: FraudReportType;
  status: FraudReportStatus;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string | null;
  beneficiary: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  reporterName: string;
  reporterId: string;
  evidence: FraudReportEvidence;
  relatedReports: RelatedFraudReport[];
  clusterMemberships: ClusterMembership[];
  governmentHits: GovernmentHitSummary[];
}

/**
 * The Fraud Investigation workflow's evidence aggregator — pulls together
 * everything an analyst needs to decide CONFIRMED vs. DISMISSED without
 * hopping between the Devices, Clusters, and Government Intelligence pages:
 * the report's own linked transaction/session/device, every *other* report
 * that corroborates it (same device or same recipient), any fraud cluster
 * it's already part of, and any government (FRI/MNRL) hits on its
 * beneficiary.
 */
export async function getFraudReportDetail(reportId: string): Promise<FraudReportDetail | null> {
  const report = await prisma.fraudReport.findUnique({
    where: { id: reportId },
    include: {
      reporter: { select: { id: true, firstName: true, lastName: true } },
      transaction: { select: { id: true, merchant: true, amount: true, date: true } },
      session: { select: { id: true, city: true, country: true, ipAddress: true, startedAt: true, riskScore: true } },
      device: { select: { id: true, label: true, trusted: true, fingerprintHash: true, similarityKey: true } },
    },
  });
  if (!report) return null;

  const relatedWhere = [
    report.deviceId ? { deviceId: report.deviceId } : undefined,
    report.beneficiary ? { beneficiary: report.beneficiary } : undefined,
  ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause));

  const relatedReportsRaw =
    relatedWhere.length > 0
      ? await prisma.fraudReport.findMany({
          where: { id: { not: report.id }, OR: relatedWhere },
          include: { reporter: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [];

  const relatedReports: RelatedFraudReport[] = relatedReportsRaw.map((related) => ({
    id: related.id,
    type: related.type,
    status: related.status,
    reporterName: `${related.reporter.firstName} ${related.reporter.lastName}`,
    createdAt: related.createdAt,
    linkReason: related.deviceId && related.deviceId === report.deviceId ? "Same device" : "Same recipient",
  }));

  const clusterEntityValues = [
    report.device?.fingerprintHash ? { entityType: "DEVICE" as const, entityValue: report.device.fingerprintHash } : null,
    report.beneficiary
      ? { entityType: "BENEFICIARY" as const, entityValue: report.beneficiary.toLowerCase().trim() }
      : null,
  ].filter((value): value is { entityType: "DEVICE" | "BENEFICIARY"; entityValue: string } => value !== null);

  const clusterMemberships: ClusterMembership[] = [];
  for (const { entityType, entityValue } of clusterEntityValues) {
    const member = await prisma.fraudClusterMember.findFirst({
      where: { entityType, entityValue },
      include: { cluster: { include: { members: true } } },
    });
    if (member) {
      clusterMemberships.push({
        id: member.cluster.id,
        label: member.cluster.label,
        riskLevel: member.cluster.riskLevel,
        memberCount: member.cluster.members.length,
      });
    }
  }

  const governmentHits: GovernmentHitSummary[] = report.beneficiary
    ? (
        await prisma.governmentRiskRecord.findMany({
          where: { subjectType: "BENEFICIARY", subjectValue: report.beneficiary, matched: true },
        })
      ).map((hit) => ({ source: hit.source, riskLevel: hit.riskLevel, subjectValue: hit.subjectValue }))
    : [];

  const REPORT_SEVERITY: Record<FraudReportType, "LOW" | "MEDIUM" | "HIGH"> = {
    SUSPICIOUS_LOGIN: "HIGH",
    SUSPICIOUS_TRANSACTION: "MEDIUM",
    SUSPICIOUS_BENEFICIARY: "MEDIUM",
    NOT_ME: "HIGH",
  };

  return {
    id: report.id,
    type: report.type,
    status: report.status,
    severity: report.severity ?? REPORT_SEVERITY[report.type],
    description: report.description,
    beneficiary: report.beneficiary,
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt,
    resolutionNote: report.resolutionNote,
    reporterName: `${report.reporter.firstName} ${report.reporter.lastName}`,
    reporterId: report.reporter.id,
    evidence: {
      transaction: report.transaction
        ? {
            id: report.transaction.id,
            merchant: report.transaction.merchant,
            amount: report.transaction.amount.toString(),
            date: report.transaction.date,
          }
        : null,
      session: report.session
        ? {
            id: report.session.id,
            city: report.session.city,
            country: report.session.country,
            ipAddress: report.session.ipAddress,
            startedAt: report.session.startedAt,
            riskScore: report.session.riskScore,
          }
        : null,
      device: report.device
        ? {
            id: report.device.id,
            label: report.device.label,
            trusted: report.device.trusted,
            fingerprintHash: report.device.fingerprintHash,
            similarityKey: report.device.similarityKey,
          }
        : null,
    },
    relatedReports,
    clusterMemberships,
    governmentHits,
  };
}
