import { prisma } from "@/lib/prisma";
import { ipGeolocationProvider } from "@/services/geolocation/ip-geolocation";
import { getFinRiskFactors } from "@/services/fin/risk-contribution";

export interface LoginRiskInput {
  userId: string;
  deviceFingerprintHash?: string | null;
  ipAddress?: string | null;
}

export interface LoginRiskResult {
  score: number;
  /** Crossing this means the login needs at least OTP-level step-up, even
   * if the account has no stronger method configured — Adaptive
   * Authentication never *relaxes* below a user's own preference, but it
   * can always escalate above it. */
  requiresStepUp: boolean;
  reasons: string[];
}

const LOGIN_STEP_UP_THRESHOLD = 30;
const NEW_DEVICE_WEIGHT = 25;
const UNTRUSTED_DEVICE_WEIGHT = 15;
const UNVERIFIED_DEVICE_WEIGHT = 10;
const UNTRUSTED_LOCATION_WEIGHT = 15;

/**
 * The previously-nonexistent login-risk path: combines device
 * familiarity, location trust, and FIN signals (open fraud reports, known
 * fraud clusters) into a single score the login flow uses to decide
 * whether to require a stronger authentication method than the user's own
 * preference. Deliberately read-only — it never mutates `Device`/
 * `TrustedLocation` state itself, since that happens once as part of
 * `registerDevice`/`resolveSessionLocation` after sign-in completes.
 */
export async function scoreLogin(input: LoginRiskInput): Promise<LoginRiskResult> {
  let score = 0;
  const reasons: string[] = [];

  if (input.deviceFingerprintHash) {
    const device = await prisma.device.findUnique({
      where: { userId_fingerprintHash: { userId: input.userId, fingerprintHash: input.deviceFingerprintHash } },
    });
    if (!device) {
      score += NEW_DEVICE_WEIGHT;
      reasons.push("Signing in from a device we haven't seen before.");
    } else if (!device.trusted) {
      score += UNTRUSTED_DEVICE_WEIGHT;
      reasons.push("Signing in from a device that hasn't been confirmed as trusted.");
    }
  } else {
    score += UNVERIFIED_DEVICE_WEIGHT;
    reasons.push("This device could not be verified.");
  }

  const location = await ipGeolocationProvider.lookup(input.ipAddress ?? null);
  if (location.city) {
    const trustedLocation = await prisma.trustedLocation.findFirst({
      where: { userId: input.userId, city: location.city, country: location.country },
    });
    if (!trustedLocation?.trusted) {
      score += UNTRUSTED_LOCATION_WEIGHT;
      reasons.push(`Signing in from ${location.city}, a location we haven't confirmed as trusted.`);
    }
  }

  const finFactors = await getFinRiskFactors(input.userId, {
    deviceFingerprintHash: input.deviceFingerprintHash ?? undefined,
  });
  if (finFactors.length > 0) {
    score += finFactors.reduce((sum, factor) => sum + factor.contribution, 0);
    reasons.push(...finFactors.map((factor) => factor.detail));
  }

  const clampedScore = Math.min(100, score);
  return { score: clampedScore, requiresStepUp: clampedScore >= LOGIN_STEP_UP_THRESHOLD, reasons };
}
