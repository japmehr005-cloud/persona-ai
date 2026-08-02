import { createHash } from "crypto";

import type { FinEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordFinEvent } from "@/services/fin/fin-event-logger";
import { logAuditEvent } from "@/services/audit/audit-logger";

export interface DeviceComponents {
  platform?: string | null;
  timezone?: string | null;
  language?: string | null;
  screenResolution?: string | null;
  hardwareConcurrency?: number | null;
  colorDepth?: number | null;
}

/**
 * Coarse fuzzy-match key deliberately built from only the *stable* device
 * characteristics (platform/timezone/language/screen) — excluding IP
 * address and browser minor-version, both of which change far more often
 * than the underlying physical device does. This is what lets a VPN
 * switch, or a routine Chrome update, keep resolving to "the same device"
 * instead of minting a brand-new identity every time.
 */
export function computeSimilarityKey(components: DeviceComponents): string {
  const raw = [
    components.platform ?? "",
    components.timezone ?? "",
    components.language ?? "",
    components.screenResolution ?? "",
  ]
    .join("|")
    .toLowerCase();

  return createHash("sha256").update(raw).digest("hex");
}

export interface SimilarDeviceView {
  id: string;
  label: string;
  trusted: boolean;
  lastSeenAt: Date;
  userId: string;
  userLabel: string;
}

/** Devices belonging to *other* users that share this similarity key —
 * used both by FIN risk contribution and the Admin SOC device graph to
 * surface possible shared-device fraud rings. */
export async function findSimilarDevicesAcrossUsers(
  userId: string,
  similarityKey: string
): Promise<SimilarDeviceView[]> {
  if (!similarityKey) return [];

  const devices = await prisma.device.findMany({
    where: { similarityKey, userId: { not: userId } },
    orderBy: { lastSeenAt: "desc" },
    take: 10,
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  return devices.map((device) => ({
    id: device.id,
    label: device.label,
    trusted: device.trusted,
    lastSeenAt: device.lastSeenAt,
    userId: device.userId,
    userLabel: `${device.user.firstName} ${device.user.lastName}`,
  }));
}

/**
 * Fills the previously-missing "mark this device as trusted" gap (only
 * revoke existed before). Explicit customer confirmation is treated as a
 * strong positive signal by the Risk Engine's device-trust factor.
 */
export async function markDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
  const result = await prisma.device.updateMany({
    where: { id: deviceId, userId },
    data: { trusted: true },
  });
  if (result.count === 0) return false;

  await Promise.all([
    recordFinEvent({
      type: "DEVICE_TRUSTED",
      severity: "LOW",
      userId,
      deviceId,
      summary: "Customer confirmed a device as trusted",
    }),
    logAuditEvent({ userId, action: "DEVICE_TRUSTED", entityType: "Device", entityId: deviceId }),
  ]);

  return true;
}

export interface LoginTimelineEntry {
  id: string;
  kind: "session" | "fin-event";
  label: string;
  detail: string | null;
  ipAddress: string | null;
  city: string | null;
  country: string | null;
  trusted: boolean;
  isSuspicious: boolean;
  occurredAt: Date;
}

const LOGIN_TIMELINE_LIMIT = 40;

const LOGIN_FIN_EVENT_TYPES: FinEventType[] = [
  "LOGIN_NEW_DEVICE",
  "LOGIN_NEW_LOCATION",
  "LOGIN_HIGH_RISK",
  "LOGIN_STEP_UP_REQUIRED",
  "LOGIN_STEP_UP_COMPLETED",
];

/** Combines raw `Session` rows (one per sign-in) with FIN login-related
 * events (new device/location detected, step-up required, etc.) into one
 * chronological feed for the customer's Login History page — every
 * unusual sign-in the Risk Engine flagged shows up right alongside the
 * plain session record it belongs to. */
export async function getLoginTimeline(userId: string): Promise<LoginTimelineEntry[]> {
  const [sessions, finEvents] = await Promise.all([
    prisma.session.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: LOGIN_TIMELINE_LIMIT,
      include: { device: { select: { label: true } } },
    }),
    prisma.finEvent.findMany({
      where: { userId, type: { in: LOGIN_FIN_EVENT_TYPES } },
      orderBy: { createdAt: "desc" },
      take: LOGIN_TIMELINE_LIMIT,
    }),
  ]);

  const sessionEntries: LoginTimelineEntry[] = sessions.map((session) => ({
    id: session.id,
    kind: "session" as const,
    label: session.device?.label ?? "Unknown device",
    detail: session.ipAddress,
    ipAddress: session.ipAddress,
    city: session.city,
    country: session.country,
    trusted: session.trusted,
    isSuspicious: session.isSuspicious,
    occurredAt: session.startedAt,
  }));

  const eventEntries: LoginTimelineEntry[] = finEvents.map((event) => ({
    id: event.id,
    kind: "fin-event" as const,
    label: event.type.replaceAll("_", " "),
    detail: event.summary,
    ipAddress: event.ipAddress,
    city: null,
    country: null,
    trusted: false,
    isSuspicious: event.severity === "HIGH",
    occurredAt: event.createdAt,
  }));

  return [...sessionEntries, ...eventEntries]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, LOGIN_TIMELINE_LIMIT);
}
