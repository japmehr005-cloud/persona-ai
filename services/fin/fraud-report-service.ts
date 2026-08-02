import { prisma } from "@/lib/prisma";
import type { AlertSeverity, FraudReportStatus, FraudReportType } from "@prisma/client";
import { recordFinEvent } from "@/services/fin/fin-event-logger";
import { logAuditEvent } from "@/services/audit/audit-logger";
import { recomputeClusters } from "@/services/fin/cluster-engine";

export interface SubmitFraudReportInput {
  reporterUserId: string;
  type: FraudReportType;
  description?: string | null;
  transactionId?: string | null;
  sessionId?: string | null;
  deviceId?: string | null;
  beneficiary?: string | null;
}

const REPORT_SEVERITY: Record<FraudReportType, "LOW" | "MEDIUM" | "HIGH"> = {
  SUSPICIOUS_LOGIN: "HIGH",
  SUSPICIOUS_TRANSACTION: "MEDIUM",
  SUSPICIOUS_BENEFICIARY: "MEDIUM",
  NOT_ME: "HIGH",
};

const REPORT_TYPE_LABEL: Record<FraudReportType, string> = {
  SUSPICIOUS_LOGIN: "Suspicious login reported",
  SUSPICIOUS_TRANSACTION: "Suspicious transaction reported",
  SUSPICIOUS_BENEFICIARY: "Suspicious beneficiary reported",
  NOT_ME: "\"This wasn't me\" reported",
};

/**
 * Recomputes fraud clusters right after a report is filed or resolved, so
 * the Admin SOC's relationship graph/cluster view updates within the same
 * live-polling cycle instead of waiting for a manual "Recompute" click.
 * Swallows errors (matching `recordFinEvent`'s never-throw contract) — a
 * failed recompute should never fail the report submission/resolution
 * itself; the next report or the manual button will retry it.
 */
async function triggerClusterRecompute(): Promise<void> {
  try {
    await recomputeClusters();
  } catch (error) {
    console.error("[FIN] Failed to auto-recompute fraud clusters", error);
  }
}

/**
 * Every customer-filed report is FIN's primary intake: it immediately opens
 * a `FraudReport`, records a `FinEvent` (so the Admin SOC's live stream and
 * investigation timeline update instantly), and — when the report names a
 * device or session — flags that device/session as suspicious right away
 * rather than waiting for an analyst to review it. Verified/confirmed
 * reports later feed `cluster-engine.ts` and `risk-contribution.ts`, so
 * every report permanently strengthens future risk assessments.
 */
export async function submitFraudReport(input: SubmitFraudReportInput) {
  const report = await prisma.fraudReport.create({
    data: {
      reporterUserId: input.reporterUserId,
      type: input.type,
      description: input.description ?? null,
      transactionId: input.transactionId ?? null,
      sessionId: input.sessionId ?? null,
      deviceId: input.deviceId ?? null,
      beneficiary: input.beneficiary ?? null,
      severity: REPORT_SEVERITY[input.type],
    },
  });

  const sideEffects: Promise<unknown>[] = [];

  if (input.sessionId) {
    sideEffects.push(
      prisma.session.update({ where: { id: input.sessionId }, data: { isSuspicious: true } })
    );
  }
  if (input.deviceId) {
    sideEffects.push(prisma.device.update({ where: { id: input.deviceId }, data: { trusted: false } }));
  }

  sideEffects.push(
    recordFinEvent({
      type: "FRAUD_REPORT_FILED",
      severity: REPORT_SEVERITY[input.type],
      userId: input.reporterUserId,
      deviceId: input.deviceId ?? null,
      sessionId: input.sessionId ?? null,
      transactionId: input.transactionId ?? null,
      beneficiary: input.beneficiary ?? null,
      summary: REPORT_TYPE_LABEL[input.type],
      metadata: { fraudReportId: report.id, description: input.description ?? undefined },
    })
  );

  sideEffects.push(
    logAuditEvent({
      userId: input.reporterUserId,
      action: "FRAUD_REPORT_FILED",
      entityType: "FraudReport",
      entityId: report.id,
      metadata: { type: input.type },
    })
  );

  await Promise.all(sideEffects);
  await triggerClusterRecompute();

  return report;
}

export interface FraudReportView {
  id: string;
  type: FraudReportType;
  status: FraudReportStatus;
  severity: AlertSeverity;
  description: string | null;
  beneficiary: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  reporterName: string;
  transactionSummary: string | null;
  deviceLabel: string | null;
}

interface RawFraudReport {
  id: string;
  type: FraudReportType;
  status: FraudReportStatus;
  severity: AlertSeverity | null;
  description: string | null;
  beneficiary: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  reporter: { firstName: string; lastName: string };
  transaction: { merchant: string; amount: import("@prisma/client").Prisma.Decimal } | null;
  device: { label: string } | null;
}

function toView(report: RawFraudReport): FraudReportView {
  return {
    id: report.id,
    type: report.type,
    status: report.status,
    // Historical reports created before severity existed fall back to the
    // same type-based default a newly-filed report would get.
    severity: report.severity ?? REPORT_SEVERITY[report.type],
    description: report.description,
    beneficiary: report.beneficiary,
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt,
    resolutionNote: report.resolutionNote,
    reporterName: `${report.reporter.firstName} ${report.reporter.lastName}`,
    transactionSummary: report.transaction
      ? `${report.transaction.merchant} · ${Number(report.transaction.amount).toFixed(2)}`
      : null,
    deviceLabel: report.device?.label ?? null,
  };
}

export async function getFraudReportsForUser(userId: string): Promise<FraudReportView[]> {
  const reports = await prisma.fraudReport.findMany({
    where: { reporterUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { firstName: true, lastName: true } },
      transaction: { select: { merchant: true, amount: true } },
      device: { select: { label: true } },
    },
  });

  return reports.map(toView);
}

export async function getAllFraudReports(): Promise<FraudReportView[]> {
  const reports = await prisma.fraudReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      reporter: { select: { firstName: true, lastName: true } },
      transaction: { select: { merchant: true, amount: true } },
      device: { select: { label: true } },
    },
  });

  return reports.map(toView);
}

export async function resolveFraudReport(
  reportId: string,
  resolvedByUserId: string,
  status: "CONFIRMED" | "DISMISSED",
  resolutionNote?: string
) {
  const report = await prisma.fraudReport.update({
    where: { id: reportId },
    data: { status, resolvedByUserId, resolutionNote: resolutionNote ?? null, resolvedAt: new Date() },
  });

  await recordFinEvent({
    type: "FRAUD_REPORT_RESOLVED",
    severity: status === "CONFIRMED" ? "HIGH" : "LOW",
    userId: report.reporterUserId,
    deviceId: report.deviceId,
    sessionId: report.sessionId,
    transactionId: report.transactionId,
    beneficiary: report.beneficiary,
    summary: `Fraud report ${status === "CONFIRMED" ? "confirmed" : "dismissed"} by analyst`,
    metadata: { fraudReportId: report.id, resolvedByUserId },
  });

  await triggerClusterRecompute();

  return report;
}

/**
 * Lets an analyst override a report's auto-assigned severity from the
 * Fraud Investigation workflow — e.g. escalating a `SUSPICIOUS_TRANSACTION`
 * report to HIGH once evidence review shows it's part of a larger ring.
 */
export async function updateFraudReportSeverity(
  reportId: string,
  severity: AlertSeverity
): Promise<FraudReportView> {
  const report = await prisma.fraudReport.update({
    where: { id: reportId },
    data: { severity },
    include: {
      reporter: { select: { firstName: true, lastName: true } },
      transaction: { select: { merchant: true, amount: true } },
      device: { select: { label: true } },
    },
  });

  return toView(report);
}
