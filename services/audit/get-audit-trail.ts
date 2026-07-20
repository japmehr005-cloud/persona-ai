import { prisma } from "@/lib/prisma";

export interface AuditTrailEntry {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: Date;
}

const AUDIT_TRAIL_LIMIT = 50;

export async function getAuditTrailForEntities(entityIds: string[]): Promise<AuditTrailEntry[]> {
  if (entityIds.length === 0) return [];

  const logs = await prisma.auditLog.findMany({
    where: { entityId: { in: entityIds } },
    orderBy: { createdAt: "desc" },
    take: AUDIT_TRAIL_LIMIT,
    include: { user: { select: { firstName: true, lastName: true, role: true } } },
  });

  return logs.map(toAuditTrailEntry);
}

/**
 * Fetches audit log entries for many entities in a single query and groups
 * them by entityId, useful for list views (e.g. the flagged transaction queue)
 * that would otherwise need one query per row.
 */
export async function getAuditTrailGroupedByEntity(
  entityIds: string[]
): Promise<Map<string, AuditTrailEntry[]>> {
  const groups = new Map<string, AuditTrailEntry[]>();
  if (entityIds.length === 0) return groups;

  const logs = await prisma.auditLog.findMany({
    where: { entityId: { in: entityIds } },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { firstName: true, lastName: true, role: true } } },
  });

  for (const log of logs) {
    const entry = toAuditTrailEntry(log);
    const existing = groups.get(log.entityId);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(log.entityId, [entry]);
    }
  }

  return groups;
}

function toAuditTrailEntry(log: {
  id: string;
  action: string;
  createdAt: Date;
  user: { firstName: string; lastName: string; role: string } | null;
}): AuditTrailEntry {
  return {
    id: log.id,
    action: log.action,
    actorName: log.user
      ? `${log.user.firstName} ${log.user.lastName}${log.user.role !== "CUSTOMER" ? " (analyst)" : ""}`
      : null,
    createdAt: log.createdAt,
  };
}
