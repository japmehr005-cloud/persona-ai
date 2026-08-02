"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { submitFraudReport } from "@/services/fin/fraud-report-service";
import { markLocationTrusted } from "@/services/geolocation/resolve-session-location";
import { prisma } from "@/lib/prisma";

const FRAUD_REPORT_LIMIT = 10;
const FRAUD_REPORT_WINDOW_MS = 15 * 60 * 1000;

const submitFraudReportSchema = z.object({
  type: z.enum(["SUSPICIOUS_LOGIN", "SUSPICIOUS_TRANSACTION", "SUSPICIOUS_BENEFICIARY", "NOT_ME"]),
  description: z.string().max(1000).optional(),
  transactionId: z.string().optional(),
  sessionId: z.string().optional(),
  deviceId: z.string().optional(),
  beneficiary: z.string().max(200).optional(),
});

export interface FraudReportActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Every FIN customer report — suspicious login, suspicious transaction,
 * suspicious beneficiary, or "This wasn't me" — funnels through this one
 * action so every report is scoped to the authenticated reporter (never a
 * caller-supplied `reporterUserId`) and immediately visible across the
 * customer's own security pages and the Admin SOC.
 */
export async function submitFraudReportAction(
  input: z.infer<typeof submitFraudReportSchema>
): Promise<FraudReportActionResult> {
  const user = await requireUser();

  const rateLimit = checkRateLimit(`fraud-report:${user.id}`, FRAUD_REPORT_LIMIT, FRAUD_REPORT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many reports submitted. Please wait a few minutes and try again." };
  }

  const parsed = submitFraudReportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please provide the required details for this report." };
  }

  // Ownership checks — a report can only reference the reporter's own
  // transaction/session/device, never another customer's.
  if (parsed.data.transactionId) {
    const owns = await prisma.transaction.findFirst({
      where: { id: parsed.data.transactionId, account: { userId: user.id } },
      select: { id: true },
    });
    if (!owns) return { ok: false, error: "That transaction could not be found." };
  }
  if (parsed.data.sessionId) {
    const owns = await prisma.session.findFirst({
      where: { id: parsed.data.sessionId, userId: user.id },
      select: { id: true },
    });
    if (!owns) return { ok: false, error: "That session could not be found." };
  }
  if (parsed.data.deviceId) {
    const owns = await prisma.device.findFirst({
      where: { id: parsed.data.deviceId, userId: user.id },
      select: { id: true },
    });
    if (!owns) return { ok: false, error: "That device could not be found." };
  }

  await submitFraudReport({
    reporterUserId: user.id,
    type: parsed.data.type,
    description: parsed.data.description ?? null,
    transactionId: parsed.data.transactionId ?? null,
    sessionId: parsed.data.sessionId ?? null,
    deviceId: parsed.data.deviceId ?? null,
    beneficiary: parsed.data.beneficiary ?? null,
  });

  revalidatePath("/security/login-history");
  revalidatePath("/security/devices");
  revalidatePath("/security/events");
  revalidatePath("/transactions");
  if (parsed.data.transactionId) revalidatePath(`/transactions/${parsed.data.transactionId}`);

  return { ok: true };
}

export async function markLocationTrustedAction(locationId: string): Promise<FraudReportActionResult> {
  const user = await requireUser();
  const success = await markLocationTrusted(user.id, locationId);
  if (!success) return { ok: false, error: "That location could not be found." };

  revalidatePath("/security/locations");
  return { ok: true };
}
