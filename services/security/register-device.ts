import type { RiskTier, SessionAuthMethod } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeSimilarityKey } from "@/services/fin/device-intelligence";
import { recordFinEvent } from "@/services/fin/fin-event-logger";
import {
  resolveSessionLocation,
  type BrowserLocationInput,
} from "@/services/geolocation/resolve-session-location";
import { detectImpossibleTravel } from "@/services/geolocation/impossible-travel";
import { scoreLogin } from "@/services/risk-engine/score-login";
import { tierForScore } from "@/services/risk-engine/threshold-policy";

const SESSION_REUSE_WINDOW_MINUTES = 30;

export interface RegisterDeviceInput {
  userId: string;
  fingerprintHash: string;
  label: string;
  userAgent: string;
  ipAddress: string | null;
  platform?: string;
  language?: string;
  timezone?: string;
  screenResolution?: string;
  hardwareConcurrency?: number | null;
  colorDepth?: number | null;
  /** The method that won at sign-in for the JWT this page load is running
   * under — read server-side from `requireUser().authMethod`, not supplied
   * by the client. Optional so pre-existing callers (and the reuse window's
   * touch-only updates) don't need to change. */
  authMethod?: SessionAuthMethod | null;
  /** Optional browser geolocation captured client-side. When present it
   * takes priority over IP geolocation; when absent/denied, IP is used. */
  browserLocation?: BrowserLocationInput | null;
}

/**
 * Registers (or touches) a device and its associated session on page load.
 * The first device ever seen for a user is auto-trusted, since it is
 * presumed to be the device they signed up / logged in from. Every
 * subsequent new fingerprint starts untrusted until the customer confirms
 * it from the Devices & Sessions page — this untrusted state is one of the
 * signals the Adaptive Risk Engine reads.
 *
 * Phase 9 additionally: stores the richer device-intelligence snapshot and
 * a coarse `similarityKey` (device-intelligence.ts), resolves the session's
 * real-if-available location (geolocation service), and raises FIN events
 * for brand-new devices/locations so the SOC's live stream and the Risk
 * Engine both see it immediately.
 *
 * FIN Enterprise Upgrade additionally: persists a login-risk snapshot
 * (`riskScore`/`riskTier`) and the resolved `authMethod` directly onto the
 * `Session` row (previously computed only transiently in `scoreLogin` and
 * never stored), links every FIN event raised here back to the session via
 * `sessionId` (previously only `deviceId`/`ipAddress`), and runs a
 * geo-velocity "impossible travel" check against the customer's immediately
 * preceding session — all three together are what make the customer
 * Security Map and admin Threat Map possible without any placeholder data.
 */
export async function registerDevice(input: RegisterDeviceInput) {
  const existingDeviceCount = await prisma.device.count({ where: { userId: input.userId } });
  const isFirstDevice = existingDeviceCount === 0;

  const similarityKey = computeSimilarityKey({
    platform: input.platform,
    timezone: input.timezone,
    language: input.language,
    screenResolution: input.screenResolution,
  });

  const existingDevice = await prisma.device.findUnique({
    where: { userId_fingerprintHash: { userId: input.userId, fingerprintHash: input.fingerprintHash } },
  });
  const isNewDevice = !existingDevice;

  const device = await prisma.device.upsert({
    where: {
      userId_fingerprintHash: { userId: input.userId, fingerprintHash: input.fingerprintHash },
    },
    update: {
      lastSeenAt: new Date(),
      label: input.label,
      userAgent: input.userAgent,
      platform: input.platform,
      language: input.language,
      timezone: input.timezone,
      screenResolution: input.screenResolution,
      hardwareConcurrency: input.hardwareConcurrency ?? null,
      colorDepth: input.colorDepth ?? null,
      similarityKey,
    },
    create: {
      userId: input.userId,
      fingerprintHash: input.fingerprintHash,
      label: input.label,
      userAgent: input.userAgent,
      trusted: isFirstDevice,
      platform: input.platform,
      language: input.language,
      timezone: input.timezone,
      screenResolution: input.screenResolution,
      hardwareConcurrency: input.hardwareConcurrency ?? null,
      colorDepth: input.colorDepth ?? null,
      similarityKey,
    },
  });

  const location = await resolveSessionLocation(input.userId, input.ipAddress, input.browserLocation);

  const reuseWindowStart = new Date(Date.now() - SESSION_REUSE_WINDOW_MINUTES * 60 * 1000);
  const recentSession = await prisma.session.findFirst({
    where: { userId: input.userId, deviceId: device.id, lastActiveAt: { gte: reuseWindowStart } },
    orderBy: { lastActiveAt: "desc" },
  });

  // Login-risk snapshot — computed here (rather than only at login-form
  // submission time in `scoreLogin`'s original caller) so it always has a
  // real `Device` row to check trust against, and so every session — not
  // just the ones that happened to trigger a step-up — carries a score.
  const loginRisk = await scoreLogin({
    userId: input.userId,
    deviceFingerprintHash: input.fingerprintHash,
    ipAddress: input.ipAddress,
  });
  const riskTier: RiskTier = tierForScore(loginRisk.score);

  let isSuspiciousFromTravel = false;
  let session: { id: string };

  if (recentSession) {
    await prisma.session.update({
      where: { id: recentSession.id },
      data: {
        lastActiveAt: new Date(),
        city: location.city,
        region: location.region,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        locationSource: location.locationSource,
        trusted: location.trusted,
        riskScore: loginRisk.score,
        riskTier,
        authMethod: input.authMethod ?? undefined,
      },
    });
    session = recentSession;
  } else {
    // Impossible-travel check only makes sense between two distinct login
    // events, so it runs exactly once per brand-new session — reusing an
    // existing session (above) is the same continuing sign-in, not a new
    // "arrival" anywhere.
    if (location.latitude !== null && location.longitude !== null) {
      const previousSession = await prisma.session.findFirst({
        where: {
          userId: input.userId,
          latitude: { not: null },
          longitude: { not: null },
        },
        orderBy: { lastActiveAt: "desc" },
        select: { latitude: true, longitude: true, lastActiveAt: true },
      });

      if (previousSession && previousSession.latitude !== null && previousSession.longitude !== null) {
        const travel = detectImpossibleTravel({
          previous: {
            latitude: previousSession.latitude,
            longitude: previousSession.longitude,
            timestamp: previousSession.lastActiveAt,
          },
          next: { latitude: location.latitude, longitude: location.longitude, timestamp: new Date() },
        });
        isSuspiciousFromTravel = travel.isImpossible;
      }
    }

    session = await prisma.session.create({
      data: {
        userId: input.userId,
        deviceId: device.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        city: location.city,
        region: location.region,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        locationSource: location.locationSource,
        trusted: location.trusted,
        isSuspicious: isSuspiciousFromTravel,
        riskScore: loginRisk.score,
        riskTier,
        authMethod: input.authMethod ?? undefined,
      },
    });
  }

  if (isNewDevice && !isFirstDevice) {
    await recordFinEvent({
      type: "LOGIN_NEW_DEVICE",
      severity: "MEDIUM",
      userId: input.userId,
      deviceId: device.id,
      sessionId: session.id,
      ipAddress: input.ipAddress,
      summary: `New device recognized: ${input.label}`,
    });
  }

  if (location.isNewLocation && !isFirstDevice) {
    await recordFinEvent({
      type: "LOGIN_NEW_LOCATION",
      severity: "LOW",
      userId: input.userId,
      deviceId: device.id,
      sessionId: session.id,
      ipAddress: input.ipAddress,
      summary: location.city
        ? `New location recognized: ${location.city}, ${location.country ?? ""}`.trim()
        : "New location recognized",
    });
  }

  if (isSuspiciousFromTravel) {
    await recordFinEvent({
      type: "IMPOSSIBLE_TRAVEL_DETECTED",
      severity: "HIGH",
      userId: input.userId,
      deviceId: device.id,
      sessionId: session.id,
      ipAddress: input.ipAddress,
      summary: location.city
        ? `Impossible travel detected — sign-in from ${location.city} could not physically follow the previous login in time.`
        : "Impossible travel detected between consecutive sign-ins.",
    });
  }

  return device;
}
