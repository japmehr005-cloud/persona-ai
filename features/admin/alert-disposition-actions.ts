"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAnalyst } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/services/audit/audit-logger";

const dispositionSchema = z.object({
  alertId: z.string().min(1),
  disposition: z.enum(["CONFIRMED_FRAUD", "FALSE_POSITIVE", "ESCALATED"]),
  analystNote: z.string().max(1000).optional(),
});

const RESOLVING_DISPOSITIONS = new Set(["CONFIRMED_FRAUD", "FALSE_POSITIVE"]);

export async function setAlertDispositionAction(
  input: z.infer<typeof dispositionSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const analyst = await requireAnalyst();

  const parsed = dispositionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid disposition." };
  }

  const nextStatus = RESOLVING_DISPOSITIONS.has(parsed.data.disposition) ? "RESOLVED" : "ACKNOWLEDGED";

  await prisma.alert.update({
    where: { id: parsed.data.alertId },
    data: {
      disposition: parsed.data.disposition,
      analystNote: parsed.data.analystNote || null,
      status: nextStatus,
      resolvedAt: nextStatus === "RESOLVED" ? new Date() : null,
    },
  });

  await logAuditEvent({
    userId: analyst.id,
    action: "ANALYST_SET_ALERT_DISPOSITION",
    entityType: "Alert",
    entityId: parsed.data.alertId,
    metadata: { disposition: parsed.data.disposition },
  });

  revalidatePath("/admin/alerts");
  revalidatePath("/admin");
  revalidatePath("/admin/analytics");

  return { ok: true };
}
