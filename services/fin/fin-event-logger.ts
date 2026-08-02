import { prisma } from "@/lib/prisma";
import type { AlertSeverity, FinEventType, Prisma } from "@prisma/client";

export interface RecordFinEventInput {
  type: FinEventType;
  severity: AlertSeverity;
  userId?: string | null;
  deviceId?: string | null;
  sessionId?: string | null;
  transactionId?: string | null;
  beneficiary?: string | null;
  ipAddress?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * The Fraud Intelligence Network's structured event log — the correlation
 * counterpart to `logAuditEvent` (which is free-form and entity-scoped
 * only). Every module that feeds FIN (fraud reports, device intelligence,
 * government intelligence, adaptive authentication, context intelligence)
 * writes through here so the Admin SOC's investigation timeline and live
 * event stream have one consistent, severity/type-indexed source. Never
 * throws — a failed FIN write should not block the action being recorded.
 */
export async function recordFinEvent(input: RecordFinEventInput): Promise<void> {
  try {
    await prisma.finEvent.create({
      data: {
        type: input.type,
        severity: input.severity,
        userId: input.userId ?? null,
        deviceId: input.deviceId ?? null,
        sessionId: input.sessionId ?? null,
        transactionId: input.transactionId ?? null,
        beneficiary: input.beneficiary ?? null,
        ipAddress: input.ipAddress ?? null,
        summary: input.summary,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (error) {
    console.error("[FIN] Failed to record event", input.type, error);
  }
}

export interface FinEventView {
  id: string;
  type: FinEventType;
  severity: AlertSeverity;
  summary: string;
  userName: string | null;
  deviceLabel: string | null;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
}

const RECENT_EVENTS_LIMIT = 200;

/** Admin SOC investigation timeline / live event stream feed. */
export async function getRecentFinEvents(options?: {
  limit?: number;
  userId?: string;
  severity?: AlertSeverity[];
}): Promise<FinEventView[]> {
  const events = await prisma.finEvent.findMany({
    where: {
      userId: options?.userId,
      severity: options?.severity ? { in: options.severity } : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? RECENT_EVENTS_LIMIT,
    include: {
      user: { select: { firstName: true, lastName: true } },
      device: { select: { label: true } },
    },
  });

  return events.map((event) => ({
    id: event.id,
    type: event.type,
    severity: event.severity,
    summary: event.summary,
    userName: event.user ? `${event.user.firstName} ${event.user.lastName}` : null,
    deviceLabel: event.device?.label ?? null,
    createdAt: event.createdAt,
    metadata: (event.metadata as Record<string, unknown> | null) ?? null,
  }));
}

/** Customer-facing "Security events" feed — scoped strictly to their own events. */
export async function getFinEventsForUser(userId: string, limit = 50): Promise<FinEventView[]> {
  return getRecentFinEvents({ userId, limit });
}
