import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { buildContextHash } from "@/services/otp-engine/context-hasher";
import { deliverOtp } from "@/services/otp-engine/otp-delivery";
import { logAuditEvent } from "@/services/audit/audit-logger";

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const BCRYPT_ROUNDS = 10;

export interface CreateChallengeInput {
  userId: string;
  userEmail: string;
  transactionId: string;
  amount: number;
  merchant: string;
  beneficiary: string | null;
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
 * Creates a context-bound OTP challenge for a high-risk transaction and
 * dispatches the code to the customer. The raw code is never persisted —
 * only its bcrypt hash — and the context hash ties the challenge to this
 * exact transaction so it cannot be reused elsewhere.
 */
export async function createOtpChallenge(input: CreateChallengeInput): Promise<CreateChallengeResult> {
  const code = generateOtpCode();
  const otpHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const timestamp = new Date();
  const expiresAt = new Date(timestamp.getTime() + OTP_TTL_MS);

  const contextHash = buildContextHash({
    userId: input.userId,
    transactionId: input.transactionId,
    amount: input.amount,
    beneficiary: input.beneficiary,
    timestamp,
  });

  const challenge = await prisma.otpChallenge.create({
    data: {
      transactionId: input.transactionId,
      contextHash,
      otpHash,
      maxAttempts: MAX_ATTEMPTS,
      expiresAt,
    },
  });

  const delivery = await deliverOtp({
    toEmail: input.userEmail,
    code,
    merchant: input.merchant,
    amount: input.amount,
  });

  await logAuditEvent({
    userId: input.userId,
    action: "OTP_CHALLENGE_CREATED",
    entityType: "Transaction",
    entityId: input.transactionId,
    metadata: { channel: delivery.channel },
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
 * success, approves the transaction and resolves any linked alert. On
 * failure, tracks attempts and denies the transaction once the limit is
 * exhausted — mirroring the CB-OTP flow's approve/deny branches.
 */
export async function verifyOtpChallenge(
  userId: string,
  challengeId: string,
  submittedCode: string
): Promise<VerifyOtpResult> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { id: challengeId, transaction: { account: { userId } } },
    include: { transaction: true },
  });

  if (!challenge) return { ok: false, reason: "not-found" };
  if (challenge.status !== "PENDING") return { ok: false, reason: "not-found" };

  if (challenge.expiresAt < new Date()) {
    await Promise.all([
      prisma.otpChallenge.update({ where: { id: challenge.id }, data: { status: "EXPIRED" } }),
      prisma.transaction.update({ where: { id: challenge.transactionId }, data: { status: "DENIED" } }),
    ]);
    await logAuditEvent({
      userId,
      action: "OTP_CHALLENGE_EXPIRED",
      entityType: "Transaction",
      entityId: challenge.transactionId,
    });
    return { ok: false, reason: "expired" };
  }

  const isMatch = await bcrypt.compare(submittedCode, challenge.otpHash);

  if (isMatch) {
    await prisma.$transaction([
      prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { status: "VERIFIED", verifiedAt: new Date() },
      }),
      prisma.transaction.update({ where: { id: challenge.transactionId }, data: { status: "APPROVED" } }),
      prisma.alert.updateMany({
        where: { transactionId: challenge.transactionId },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      }),
    ]);
    await logAuditEvent({
      userId,
      action: "OTP_VERIFIED_APPROVED",
      entityType: "Transaction",
      entityId: challenge.transactionId,
    });
    return { ok: true };
  }

  const attempts = challenge.attempts + 1;
  const attemptsRemaining = challenge.maxAttempts - attempts;

  if (attemptsRemaining <= 0) {
    await Promise.all([
      prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts, status: "FAILED" } }),
      prisma.transaction.update({ where: { id: challenge.transactionId }, data: { status: "DENIED" } }),
    ]);
    await logAuditEvent({
      userId,
      action: "OTP_MAX_ATTEMPTS_DENIED",
      entityType: "Transaction",
      entityId: challenge.transactionId,
    });
    return { ok: false, reason: "max-attempts" };
  }

  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts } });
  return { ok: false, reason: "invalid-code", attemptsRemaining };
}
