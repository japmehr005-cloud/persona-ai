"use server";

import { revalidatePath } from "next/cache";

import type { AlertSeverity } from "@prisma/client";
import { requireAnalyst } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/services/audit/audit-logger";
import { resolveFraudReport, updateFraudReportSeverity, type FraudReportView } from "@/services/fin/fraud-report-service";
import { getFraudReportDetail, type FraudReportDetail } from "@/services/fin/investigation-service";

function revalidateInvestigationSurfaces() {
  revalidatePath("/admin/fin/investigations");
  revalidatePath("/admin/fin/soc");
  revalidatePath("/admin/fin/clusters");
  revalidatePath("/admin/fin/overview");
}

/** Fetches the full evidence bundle for the investigation detail sheet —
 * kept as its own on-demand action (rather than eagerly joined into the
 * queue list) since evidence/related-report/cluster/government lookups are
 * meaningfully heavier than the summary row every report needs. */
export async function getFraudReportDetailAction(reportId: string): Promise<FraudReportDetail | null> {
  await requireAnalyst();
  return getFraudReportDetail(reportId);
}

export interface ResolveFraudReportResult {
  ok: boolean;
  error?: string;
}

/**
 * Confirm/dismiss a fraud report. Wraps the existing `resolveFraudReport`
 * service (previously only ever called from the seed script) so the
 * Investigation queue actually has a working resolution workflow — and,
 * via that service, auto-triggers `recomputeClusters()` so the graph and
 * cluster views reflect the outcome within the same live-polling cycle.
 */
export async function resolveFraudReportAction(
  reportId: string,
  status: "CONFIRMED" | "DISMISSED",
  resolutionNote?: string
): Promise<ResolveFraudReportResult> {
  const analyst = await requireAnalyst();

  const rateLimit = checkRateLimit(`resolve-fraud-report:${analyst.id}`, 30, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Please wait a moment before resolving more reports." };
  }

  await resolveFraudReport(reportId, analyst.id, status, resolutionNote);

  await logAuditEvent({
    userId: analyst.id,
    action: status === "CONFIRMED" ? "FRAUD_REPORT_CONFIRMED" : "FRAUD_REPORT_DISMISSED",
    entityType: "FraudReport",
    entityId: reportId,
    metadata: { resolutionNote: resolutionNote ?? undefined },
  });

  revalidateInvestigationSurfaces();

  return { ok: true };
}

export interface UpdateSeverityResult {
  ok: boolean;
  error?: string;
  report?: FraudReportView;
}

/** Lets an analyst escalate or de-escalate a report's severity from the
 * Investigation detail sheet — writes directly to `FraudReport.severity`. */
export async function updateFraudReportSeverityAction(
  reportId: string,
  severity: AlertSeverity
): Promise<UpdateSeverityResult> {
  const analyst = await requireAnalyst();

  const report = await updateFraudReportSeverity(reportId, severity);

  await logAuditEvent({
    userId: analyst.id,
    action: "FRAUD_REPORT_SEVERITY_UPDATED",
    entityType: "FraudReport",
    entityId: reportId,
    metadata: { severity },
  });

  revalidateInvestigationSurfaces();

  return { ok: true, report };
}
