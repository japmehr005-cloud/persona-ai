import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

import type { OtpPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildContextHash } from "@/services/otp-engine/context-hasher";
import { deliverOtp } from "@/services/otp-engine/otp-delivery";
import { logAuditEvent } from "@/services/audit/audit-logger";
import { recordFinEvent } from "@/services/fin/fin-event-logger";

const OTP_LENGTH = 6;
/** Per spec: a Context-Bound OTP is short-lived by design — 60 seconds,
 * not the previous 5 minutes — so a code intercepted mid-call is already
 * worthless by the time an attacker could act on it. */
const OTP_TTL_MS = 60 * 1000;
const MAX_ATTEMPTS = 3;
const BCRYPT_ROUNDS = 10;

export interface CreateChallengeInput {
  userId: string;
  userEmail: string;
  /** Defaults to "TRANSACTION" for backward compatibility with the
   * high-risk-verification step-up flow. */
  purpose?: OtpPurpose;
  transactionId?: string | null;
  amount?: number | null;
  merchant?: string | null;
  beneficiary?: string | null;
  /** The requesting device's fingerprint hash — persisted so the OTP can
   * only be redeemed from the same device it was issued to. */
  deviceFingerprintHash?: string | null;
}

export interface CreateChallengeResult {
  challengeId: string;
  expiresAt: Date;
  /** Only set when no real email delivery channel is configured. */
  demoCode?: string;
}

function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

/**
 * Creates a context-bound OTP challenge and dispatches the code to the
 * customer. The raw code is never persisted — only its bcrypt hash — and
 * the context hash ties the challenge to this exact transaction (or, for a
 * login-purpose challenge, this exact sign-in attempt) and device so it
 * cannot be reused elsewhere. Shared by both the transaction step-up flow
 * and Adaptive Authentication's "Password + OTP" login method.
 */
export async function createOtpChallenge(input: CreateChallengeInput): Promise<CreateChallengeResult> {
  const purpose: OtpPurpose = input.purpose ?? "TRANSACTION";
  const code = generateOtpCode();
  const otpHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const timestamp = new Date();
  const expiresAt = new Date(timestamp.getTime() + OTP_TTL_MS);

  const contextHash = buildContextHash({
    userId: input.userId,
    purpose,
    transactionId: input.transactionId ?? null,
    amount: input.amount ?? null,
    beneficiary: input.beneficiary ?? null,
    deviceFingerprintHash: input.deviceFingerprintHash ?? null,
    timestamp,
  });

  const challenge = await prisma.otpChallenge.create({
    data: {
      userId: input.userId,
      transactionId: input.transactionId ?? null,
      purpose,
      contextHash,
      otpHash,
      deviceFingerprintHash: input.deviceFingerprintHash ?? null,
      maxAttempts: MAX_ATTEMPTS,
      expiresAt,
      // Explicitly set (rather than relying on the column default) so the
      // timestamp baked into `contextHash` above exactly matches what
      // `verifyOtpChallenge` reads back from `challenge.createdAt` when it
      // recomputes the hash — a DB-clock vs. app-clock skew here would
      // otherwise make every verification look like context tampering.
      createdAt: timestamp,
    },
  });

  const delivery = await deliverOtp({
    toEmail: input.userEmail,
    code,
    merchant: input.merchant ?? "your sign-in",
    amount: input.amount ?? 0,
    purpose,
  });

  await logAuditEvent({
    userId: input.userId,
    action: purpose === "LOGIN" ? "LOGIN_OTP_CHALLENGE_CREATED" : "OTP_CHALLENGE_CREATED",
    entityType: purpose === "LOGIN" ? "User" : "Transaction",
    entityId: input.transactionId ?? input.userId,
    metadata: { channel: delivery.channel, purpose },
  });

  return { challengeId: challenge.id, expiresAt, demoCode: delivery.demoCode };
}

export type VerifyOtpFailureReason =
  | "not-found"
  | "expired"
  | "max-attempts"
  | "invalid-code"
  | "rate-limited";

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: VerifyOtpFailureReason; attemptsRemaining?: number };

/**
 * Validates a submitted OTP against its context-bound challenge. On
 * success, approves the transaction (for TRANSACTION-purpose challenges)
 * and resolves any linked alert. On failure, tracks attempts and denies
 * the transaction once the limit is exhausted.
 *
 * Re-verification, not just storage: the context hash is *recomputed* from
 * the transaction's live amount/beneficiary at verify time and compared
 * against the hash captured at issuance — catching the case where the
 * underlying transaction context changed between OTP issuance and
 * redemption. The submitted device fingerprint is independently checked
 * against the fingerprint the challenge was issued to, enforcing the
 * device-bound half of "context-bound" (a code intercepted and replayed
 * from a different device is rejected even with the correct digits).
 */
export async function verifyOtpChallenge(
  userId: string,
  challengeId: string,
  submittedCode: string,
  deviceFingerprintHash?: string | null
): Promise<VerifyOtpResult> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { id: challengeId, userId },
    include: { transaction: true },
  });

  if (!challenge) return { ok: false, reason: "not-found" };
  if (challenge.status !== "PENDING") return { ok: false, reason: "not-found" };

  if (challenge.expiresAt < new Date()) {
    await Promise.all([
      prisma.otpChallenge.update({ where: { id: challenge.id }, data: { status: "EXPIRED" } }),
      challenge.transactionId
        ? prisma.transaction.update({ where: { id: challenge.transactionId }, data: { status: "DENIED" } })
        : Promise.resolve(),
    ]);
    await logAuditEvent({
      userId,
      action: "OTP_CHALLENGE_EXPIRED",
      entityType: challenge.transactionId ? "Transaction" : "User",
      entityId: challenge.transactionId ?? userId,
    });
    return { ok: false, reason: "expired" };
  }

  const recomputedContextHash = buildContextHash({
    userId,
    purpose: challenge.purpose,
    transactionId: challenge.transactionId,
    amount: challenge.transaction ? Number(challenge.transaction.amount) : null,
    beneficiary: challenge.transaction?.beneficiary ?? null,
    deviceFingerprintHash: challenge.deviceFingerprintHash,
    timestamp: challenge.createdAt,
  });

  const contextTampered = recomputedContextHash !== challenge.contextHash;
  const deviceMismatch = Boolean(
    challenge.deviceFingerprintHash &&
      deviceFingerprintHash &&
      challenge.deviceFingerprintHash !== deviceFingerprintHash
  );

  if (contextTampered || deviceMismatch) {
    await Promise.all([
      prisma.otpChallenge.update({ where: { id: challenge.id }, data: { status: "FAILED" } }),
      challenge.transactionId
        ? prisma.transaction.update({ where: { id: challenge.transactionId }, data: { status: "DENIED" } })
        : Promise.resolve(),
      recordFinEvent({
        type: "OTP_CONTEXT_MISMATCH",
        severity: "HIGH",
        userId,
        transactionId: challenge.transactionId,
        summary: deviceMismatch
          ? "OTP redeemed from a different device than it was issued to"
          : "OTP context no longer matches the transaction it was issued for",
        metadata: { challengeId: challenge.id, purpose: challenge.purpose },
      }),
    ]);
    return { ok: false, reason: "invalid-code" };
  }

  const isMatch = await bcrypt.compare(submittedCode, challenge.otpHash);

  if (isMatch) {
    await prisma.$transaction([
      prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { status: "VERIFIED", verifiedAt: new Date() },
      }),
      ...(challenge.transactionId
        ? [
            prisma.transaction.update({ where: { id: challenge.transactionId }, data: { status: "APPROVED" } }),
            prisma.alert.updateMany({
              where: { transactionId: challenge.transactionId },
              data: { status: "RESOLVED", resolvedAt: new Date() },
            }),
          ]
        : []),
    ]);
    await logAuditEvent({
      userId,
      action: challenge.purpose === "LOGIN" ? "LOGIN_OTP_VERIFIED" : "OTP_VERIFIED_APPROVED",
      entityType: challenge.transactionId ? "Transaction" : "User",
      entityId: challenge.transactionId ?? userId,
    });
    return { ok: true };
  }

  const attempts = challenge.attempts + 1;
  const attemptsRemaining = challenge.maxAttempts - attempts;

  if (attemptsRemaining <= 0) {
    await Promise.all([
      prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts, status: "FAILED" } }),
      challenge.transactionId
        ? prisma.transaction.update({ where: { id: challenge.transactionId }, data: { status: "DENIED" } })
        : Promise.resolve(),
    ]);
    await logAuditEvent({
      userId,
      action: "OTP_MAX_ATTEMPTS_DENIED",
      entityType: challenge.transactionId ? "Transaction" : "User",
      entityId: challenge.transactionId ?? userId,
    });
    return { ok: false, reason: "max-attempts" };
  }

  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts } });
  return { ok: false, reason: "invalid-code", attemptsRemaining };
}
