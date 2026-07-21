import { OTP } from "otplib";
import QRCode from "qrcode";

import { prisma } from "@/lib/prisma";

const TOTP_ISSUER = "Persona AI";
// otplib v13's unified OTP wrapper, pinned to the TOTP strategy (its
// default) with the library's default crypto/base32 plugins (Noble/Scure) —
// see `otplib`'s `OTPClassOptions` for the built-in defaults this relies on.
const totp = new OTP({ strategy: "totp" });

/** RFC 6238 recommends tolerating one time-step of clock drift either way
 * so a slightly-off phone clock doesn't reject an otherwise-correct code. */
const EPOCH_TOLERANCE_SECONDS = 30;

async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const result = await totp.verify({ secret, token: code, epochTolerance: EPOCH_TOLERANCE_SECONDS });
  return result.valid;
}

export interface TotpEnrollmentView {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/**
 * Starts (or restarts) TOTP enrollment for a user: generates a fresh secret
 * and persists it as a not-yet-`enabled` `TwoFactorCredential` row, so a
 * user who abandons enrollment mid-flow can simply scan a new QR code
 * without leaving orphaned state. The credential only flips to `enabled`
 * once `confirmTotpEnrollment` verifies a live code from the app.
 */
export async function startTotpEnrollment(userId: string, email: string): Promise<TotpEnrollmentView> {
  const secret = totp.generateSecret();
  const otpauthUrl = totp.generateURI({ issuer: TOTP_ISSUER, label: email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  await prisma.twoFactorCredential.upsert({
    where: { userId },
    create: { userId, secret, enabled: false },
    update: { secret, enabled: false, verifiedAt: null },
  });

  return { secret, otpauthUrl, qrCodeDataUrl };
}

export type ConfirmTotpEnrollmentResult =
  | { ok: true }
  | { ok: false; error: "NOT_STARTED" | "INVALID_CODE" };

export async function confirmTotpEnrollment(userId: string, code: string): Promise<ConfirmTotpEnrollmentResult> {
  const credential = await prisma.twoFactorCredential.findUnique({ where: { userId } });
  if (!credential) return { ok: false, error: "NOT_STARTED" };

  const valid = await verifyTotpCode(credential.secret, code);
  if (!valid) return { ok: false, error: "INVALID_CODE" };

  await prisma.twoFactorCredential.update({
    where: { userId },
    data: { enabled: true, verifiedAt: new Date() },
  });

  return { ok: true };
}

export type DisableTotpResult = { ok: true } | { ok: false; error: "NOT_ENABLED" | "INVALID_CODE" };

/**
 * Disabling 2FA requires a live code from the authenticator app (not just
 * being logged in) so a hijacked-but-unlocked session can't silently strip
 * the account's second factor.
 */
export async function disableTotp(userId: string, code: string): Promise<DisableTotpResult> {
  const credential = await prisma.twoFactorCredential.findUnique({ where: { userId } });
  if (!credential?.enabled) return { ok: false, error: "NOT_ENABLED" };

  const valid = await verifyTotpCode(credential.secret, code);
  if (!valid) return { ok: false, error: "INVALID_CODE" };

  await prisma.twoFactorCredential.delete({ where: { userId } });
  return { ok: true };
}
