import type { RiskTier, SessionAuthMethod } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { parseUserAgent } from "@/lib/device-fingerprint";
import { detectImpossibleTravel } from "@/services/geolocation/impossible-travel";

export type SecurityMapRiskColor = "green" | "amber" | "red";

export interface SecurityMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  country: string | null;
  accuracy: number | null;
  locationSource: "BROWSER" | "IP" | "UNKNOWN" | null;
  riskColor: SecurityMapRiskColor;
  riskScore: number | null;
  riskTier: RiskTier | null;
  authMethod: SessionAuthMethod | null;
  deviceId: string | null;
  deviceLabel: string;
  fingerprintHash: string | null;
  browser: string;
  os: string;
  ipAddress: string | null;
  deviceTrusted: boolean;
  sessionTrusted: boolean;
  isSuspicious: boolean;
  isImpossibleTravel: boolean;
  isCurrent: boolean;
  /** 1 = newest / current login; presentation-only, not persisted. */
  sequenceNumber: number;
  fraudReportCount: number;
  fraudReportTypes: string[];
  occurredAt: Date;
}

export type SecurityMapPathTone = "impossible" | "normal" | "trusted";

export interface SecurityMapPathSegment {
  fromSessionId: string;
  toSessionId: string;
  isImpossible: boolean;
  /** Visual tone for the travel arc — derived from endpoints, not stored. */
  tone: SecurityMapPathTone;
  distanceKm: number;
  elapsedHours: number;
}

export interface SecurityMapData {
  markers: SecurityMapMarker[];
  path: SecurityMapPathSegment[];
}

const SECURITY_MAP_SESSION_LIMIT = 60;

function riskColorFor(input: { isSuspicious: boolean; fraudReportCount: number; trusted: boolean; riskTier: RiskTier | null }): SecurityMapRiskColor {
  if (input.isSuspicious || input.fraudReportCount > 0) return "red";
  if (!input.trusted || (input.riskTier && input.riskTier !== "LOW")) return "amber";
  return "green";
}

interface SessionWithDevice {
  id: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  accuracy: number | null;
  locationSource: "BROWSER" | "IP" | "UNKNOWN" | null;
  ipAddress: string | null;
  userAgent: string | null;
  trusted: boolean;
  isSuspicious: boolean;
  riskScore: number | null;
  riskTier: RiskTier | null;
  authMethod: SessionAuthMethod | null;
  startedAt: Date;
  lastActiveAt: Date;
  deviceId: string | null;
  device: { id: string; label: string; trusted: boolean; fingerprintHash: string } | null;
}

function buildMarker(
  session: SessionWithDevice,
  fraudReportsBySessionOrDevice: Map<string, { type: string }[]>
): SecurityMapMarker | null {
  if (session.latitude === null || session.longitude === null) return null;

  const reports = [
    ...(fraudReportsBySessionOrDevice.get(`session:${session.id}`) ?? []),
    ...(session.deviceId ? fraudReportsBySessionOrDevice.get(`device:${session.deviceId}`) ?? [] : []),
  ];
  const { browser, os } = parseUserAgent(session.userAgent ?? "");

  return {
    id: session.id,
    latitude: session.latitude,
    longitude: session.longitude,
    city: session.city,
    region: session.region,
    country: session.country,
    accuracy: session.accuracy,
    locationSource: session.locationSource,
    riskColor: riskColorFor({
      isSuspicious: session.isSuspicious,
      fraudReportCount: reports.length,
      trusted: session.trusted,
      riskTier: session.riskTier,
    }),
    riskScore: session.riskScore,
    riskTier: session.riskTier,
    authMethod: session.authMethod,
    deviceId: session.deviceId,
    deviceLabel: session.device?.label ?? "Unknown device",
    fingerprintHash: session.device?.fingerprintHash ?? null,
    browser,
    os,
    ipAddress: session.ipAddress,
    deviceTrusted: session.device?.trusted ?? false,
    sessionTrusted: session.trusted,
    isSuspicious: session.isSuspicious,
    isImpossibleTravel: session.isSuspicious && reports.length === 0,
    isCurrent: false,
    sequenceNumber: 0,
    fraudReportCount: reports.length,
    fraudReportTypes: [...new Set(reports.map((report) => report.type))],
    occurredAt: session.startedAt,
  };
}

function pathToneFor(
  from: SecurityMapMarker,
  to: SecurityMapMarker,
  isImpossible: boolean
): SecurityMapPathTone {
  if (isImpossible) return "impossible";
  if (
    from.riskColor === "green" &&
    to.riskColor === "green" &&
    from.deviceTrusted &&
    to.deviceTrusted &&
    from.sessionTrusted &&
    to.sessionTrusted
  ) {
    return "trusted";
  }
  return "normal";
}

async function buildFraudReportIndex(sessionIds: string[], deviceIds: string[]) {
  if (sessionIds.length === 0 && deviceIds.length === 0) return new Map<string, { type: string }[]>();

  const reports = await prisma.fraudReport.findMany({
    where: {
      OR: [
        sessionIds.length > 0 ? { sessionId: { in: sessionIds } } : undefined,
        deviceIds.length > 0 ? { deviceId: { in: deviceIds } } : undefined,
      ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause)),
    },
    select: { sessionId: true, deviceId: true, type: true },
  });

  const index = new Map<string, { type: string }[]>();
  for (const report of reports) {
    if (report.sessionId) {
      const key = `session:${report.sessionId}`;
      index.set(key, [...(index.get(key) ?? []), { type: report.type }]);
    }
    if (report.deviceId) {
      const key = `device:${report.deviceId}`;
      index.set(key, [...(index.get(key) ?? []), { type: report.type }]);
    }
  }
  return index;
}

/**
 * Powers the customer Security Map + synchronized timeline: every login is
 * a `Session` row (already geo-resolved by `resolveSessionLocation` and
 * risk-scored by `registerDevice`) rendered as a marker, plus the
 * chronological path between them so impossible-travel hops render as a
 * distinct connecting line.
 */
export async function getSecurityMapForUser(userId: string): Promise<SecurityMapData> {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: SECURITY_MAP_SESSION_LIMIT,
    include: { device: { select: { id: true, label: true, trusted: true, fingerprintHash: true } } },
  });

  const sessionIds = sessions.map((session) => session.id);
  const deviceIds = [...new Set(sessions.map((session) => session.deviceId).filter((id): id is string => Boolean(id)))];
  const fraudReportIndex = await buildFraudReportIndex(sessionIds, deviceIds);

  const markers = sessions
    .map((session) => buildMarker(session, fraudReportIndex))
    .filter((marker): marker is SecurityMapMarker => marker !== null);

  if (markers.length > 0) {
    markers.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    markers[0].isCurrent = true;
    markers.forEach((marker, index) => {
      marker.sequenceNumber = index + 1;
    });
  }

  const chronological = [...markers].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const path: SecurityMapPathSegment[] = [];
  for (let i = 1; i < chronological.length; i++) {
    const prev = chronological[i - 1];
    const next = chronological[i];
    const travel = detectImpossibleTravel({
      previous: { latitude: prev.latitude, longitude: prev.longitude, timestamp: prev.occurredAt },
      next: { latitude: next.latitude, longitude: next.longitude, timestamp: next.occurredAt },
    });
    if (travel.isImpossible) {
      next.isImpossibleTravel = true;
      next.riskColor = "red";
    }
    path.push({
      fromSessionId: prev.id,
      toSessionId: next.id,
      isImpossible: travel.isImpossible,
      tone: pathToneFor(prev, next, travel.isImpossible),
      distanceKm: travel.distanceKm,
      elapsedHours: travel.elapsedHours,
    });
  }

  return { markers, path };
}

export interface ThreatMapMarker extends SecurityMapMarker {
  userId: string;
  userName: string;
}

export interface ThreatMapData {
  markers: ThreatMapMarker[];
  cityCount: number;
  suspiciousCount: number;
}

const THREAT_MAP_SESSION_LIMIT = 400;

/**
 * The Admin SOC Threat Map's data source — the most recent sessions across
 * every customer, geo-resolved and risk-annotated exactly like the
 * customer-facing map. Individual points (rather than pre-aggregated city
 * buckets) so MapLibre's native GeoJSON clustering/heatmap layers can do
 * the density visualization client-side.
 */
export async function getThreatMapData(): Promise<ThreatMapData> {
  const sessions = await prisma.session.findMany({
    orderBy: { startedAt: "desc" },
    take: THREAT_MAP_SESSION_LIMIT,
    include: {
      device: { select: { id: true, label: true, trusted: true, fingerprintHash: true } },
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const sessionIds = sessions.map((session) => session.id);
  const deviceIds = [...new Set(sessions.map((session) => session.deviceId).filter((id): id is string => Boolean(id)))];
  const fraudReportIndex = await buildFraudReportIndex(sessionIds, deviceIds);

  const markers: ThreatMapMarker[] = [];
  const cities = new Set<string>();
  let suspiciousCount = 0;
  const sequenceByUser = new Map<string, number>();

  for (const session of sessions) {
    const marker = buildMarker(session, fraudReportIndex);
    if (!marker) continue;
    if (marker.city) cities.add(`${marker.city}:${marker.country ?? ""}`);
    if (marker.riskColor === "red") suspiciousCount += 1;

    const nextSeq = (sequenceByUser.get(session.user.id) ?? 0) + 1;
    sequenceByUser.set(session.user.id, nextSeq);

    markers.push({
      ...marker,
      sequenceNumber: nextSeq,
      userId: session.user.id,
      userName: `${session.user.firstName} ${session.user.lastName}`,
    });
  }

  return { markers, cityCount: cities.size, suspiciousCount };
}
