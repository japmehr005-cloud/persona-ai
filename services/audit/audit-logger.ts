import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface AuditEventInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records a security- or operations-relevant event for the read-only audit
 * trail shown on admin pages and transaction detail. Logging failures are
 * swallowed so they never block the action being audited.
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as unknown as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error("[Persona AI] Failed to write audit log entry:", error);
  }
}
