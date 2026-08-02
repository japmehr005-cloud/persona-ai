import { prisma } from "@/lib/prisma";
import { createOtpChallenge, verifyOtpChallenge, type VerifyOtpFailureReason } from "@/services/otp-engine/otp-service";

/**
 * Adaptive Authentication Option 1 (Password + OTP) — reuses the CB-OTP
 * engine with `purpose: "LOGIN"` instead of duplicating challenge/verify
 * logic in a second implementation. A login OTP has no transaction, so its
 * context hash only binds userId/purpose/device/timestamp.
 */
export async function createLoginOtpChallenge(
  userId: string,
  userEmail: string,
  deviceFingerprintHash?: string | null
) {
  return createOtpChallenge({
    userId,
    userEmail,
    purpose: "LOGIN",
    deviceFingerprintHash: deviceFingerprintHash ?? null,
  });
}

export interface LoginOtpChallengeView {
  id: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  status: "PENDING" | "VERIFIED" | "EXPIRED" | "FAILED";
}

export async function getLoginOtpChallengeView(challengeId: string): Promise<LoginOtpChallengeView | null> {
  const challenge = await prisma.otpChallenge.findFirst({ where: { id: challengeId, purpose: "LOGIN" } });
  if (!challenge) return null;

  return {
    id: challenge.id,
    expiresAt: challenge.expiresAt,
    attempts: challenge.attempts,
    maxAttempts: challenge.maxAttempts,
    status: challenge.status,
  };
}

export type VerifyLoginOtpResult =
  | { ok: true; userId: string }
  | { ok: false; reason: VerifyOtpFailureReason; attemptsRemaining?: number };

/**
 * Verifies a login-purpose OTP challenge. Unlike the transaction step-up
 * flow (which already knows the authenticated userId), a login OTP is
 * verified *before* a session exists, so the owning userId is read from
 * the challenge itself rather than from a caller-supplied value — this is
 * safe because `challengeId` is an unguessable cuid and every attempt is
 * still rate-limited exactly like the transaction flow.
 */
export async function verifyLoginOtpChallenge(
  challengeId: string,
  code: string,
  deviceFingerprintHash?: string | null
): Promise<VerifyLoginOtpResult> {
  const challenge = await prisma.otpChallenge.findFirst({ where: { id: challengeId, purpose: "LOGIN" } });
  if (!challenge) return { ok: false, reason: "not-found" };

  const result = await verifyOtpChallenge(challenge.userId, challengeId, code, deviceFingerprintHash);
  if (!result.ok) return result;
  return { ok: true, userId: challenge.userId };
}
