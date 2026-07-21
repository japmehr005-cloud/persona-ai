import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/services/audit/audit-logger";
import { createOtpChallenge } from "@/services/otp-engine/otp-service";
import { listWebAuthnCredentials } from "@/services/auth/webauthn";
import type { RiskTier } from "@/services/risk-engine/threshold-policy";

export interface VerificationBaselineView {
  avgAmount: number | null;
  p95Amount: number | null;
  medianAmount: number | null;
  sampleSize: number | null;
}

export interface VerificationSessionView {
  transactionId: string;
  riskAssessmentId: string;
  merchant: string;
  amount: number;
  beneficiary: string | null;
  date: Date;
  score: number;
  tier: RiskTier;
  confidence: number;
  explanation: string;
  factors: { code: string; label: string; detail: string; contribution: number }[];
  baseline: VerificationBaselineView;
  deviceTrusted: boolean | null;
  /** Truncated, display-only — proves the session is bound to a specific
   * server-issued token without leaking the full credential value. */
  sessionTokenPreview: string | null;
  verificationExpiresAt: Date | null;
  /** EXPIRED is derived on read (mirrors the existing OTP challenge
   * expire-on-read pattern) rather than requiring a background job. */
  status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  hasWebAuthnCredential: boolean;
  /** Set when status is VERIFIED and an OTP challenge already exists for
   * this transaction, so a revisited/refreshed session page can still link
   * forward to `/verify/otp` instead of dead-ending. */
  pendingOtpChallengeId: string | null;
}

async function loadSession(userId: string, transactionId: string) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, account: { userId } },
    include: {
      riskAssessment: { include: { factors: { orderBy: { contribution: "desc" } } } },
      otpChallenges: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!transaction?.riskAssessment || transaction.riskAssessment.verificationStatus === "NONE") {
    return null;
  }

  return transaction;
}

/**
 * Reads a High-Risk Verification context session and auto-expires it if its
 * window has elapsed, denying the underlying transaction — the same
 * "expire on read" approach the existing CB-OTP challenge uses, so no
 * polling/cron infrastructure is needed.
 */
export async function getVerificationSession(
  userId: string,
  transactionId: string
): Promise<VerificationSessionView | null> {
  const transaction = await loadSession(userId, transactionId);
  if (!transaction) return null;

  let assessment = transaction.riskAssessment!;

  if (assessment.verificationStatus === "PENDING" && assessment.verificationExpiresAt) {
    if (assessment.verificationExpiresAt < new Date()) {
      await prisma.$transaction([
        prisma.riskAssessment.update({
          where: { id: assessment.id },
          data: { verificationStatus: "EXPIRED" },
        }),
        prisma.transaction.update({ where: { id: transactionId }, data: { status: "DENIED" } }),
      ]);
      await logAuditEvent({
        userId,
        action: "VERIFICATION_SESSION_EXPIRED",
        entityType: "Transaction",
        entityId: transactionId,
      });
      assessment = { ...assessment, verificationStatus: "EXPIRED" };
    }
  }

  const hasWebAuthnCredential = (await listWebAuthnCredentials(userId)).length > 0;

  return {
    transactionId: transaction.id,
    riskAssessmentId: assessment.id,
    merchant: transaction.merchant,
    amount: Number(transaction.amount),
    beneficiary: transaction.beneficiary,
    date: transaction.date,
    score: assessment.score,
    tier: assessment.tier,
    confidence: assessment.confidence,
    explanation: assessment.explanation,
    factors: assessment.factors.map((factor) => ({
      code: factor.code,
      label: factor.label,
      detail: factor.detail,
      contribution: factor.contribution,
    })),
    baseline: {
      avgAmount: assessment.baselineAvgAmount !== null ? Number(assessment.baselineAvgAmount) : null,
      p95Amount: assessment.baselineP95Amount !== null ? Number(assessment.baselineP95Amount) : null,
      medianAmount:
        assessment.baselineMedianAmount !== null ? Number(assessment.baselineMedianAmount) : null,
      sampleSize: assessment.baselineSampleSize,
    },
    deviceTrusted: assessment.deviceTrusted,
    sessionTokenPreview: assessment.sessionToken ? `${assessment.sessionToken.slice(0, 12)}…` : null,
    verificationExpiresAt: assessment.verificationExpiresAt,
    status: assessment.verificationStatus as "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED",
    hasWebAuthnCredential,
    pendingOtpChallengeId: transaction.otpChallenges[0]?.id ?? null,
  };
}

export type VerificationActionFailure =
  | "not-found"
  | "not-pending"
  | "expired"
  | "webauthn-failed"
  | "invalid-password";

/**
 * Customer declines to proceed — the session closes and the transaction is
 * denied. This is a deliberate, explainable customer decision, not a
 * timeout, so it's tracked as its own terminal state.
 */
export async function cancelVerificationSession(
  userId: string,
  transactionId: string
): Promise<{ ok: true } | { ok: false; reason: VerificationActionFailure }> {
  const transaction = await loadSession(userId, transactionId);
  if (!transaction) return { ok: false, reason: "not-found" };
  if (transaction.riskAssessment!.verificationStatus !== "PENDING") {
    return { ok: false, reason: "not-pending" };
  }

  await prisma.$transaction([
    prisma.riskAssessment.update({
      where: { id: transaction.riskAssessment!.id },
      data: { verificationStatus: "REJECTED" },
    }),
    prisma.transaction.update({ where: { id: transactionId }, data: { status: "DENIED" } }),
  ]);
  await logAuditEvent({
    userId,
    action: "VERIFICATION_SESSION_REJECTED",
    entityType: "Transaction",
    entityId: transactionId,
  });

  return { ok: true };
}

/**
 * Verifies the customer's identity via a password re-entry step-up (used
 * when no WebAuthn credential is registered) and, on success, marks the
 * context session VERIFIED and issues the Context-Bound OTP — CB-OTP is
 * always the final step, never skipped, even after biometric/password
 * verification.
 */
export async function verifyIdentityWithPassword(
  userId: string,
  transactionId: string,
  password: string
): Promise<
  | { ok: true; otpChallengeId: string; otpDemoCode?: string }
  | { ok: false; reason: VerificationActionFailure }
> {
  const transaction = await loadSession(userId, transactionId);
  if (!transaction) return { ok: false, reason: "not-found" };
  if (transaction.riskAssessment!.verificationStatus !== "PENDING") {
    return { ok: false, reason: "not-pending" };
  }
  if (
    transaction.riskAssessment!.verificationExpiresAt &&
    transaction.riskAssessment!.verificationExpiresAt < new Date()
  ) {
    return { ok: false, reason: "expired" };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    await logAuditEvent({
      userId,
      action: "VERIFICATION_STEP_UP_PASSWORD_FAILED",
      entityType: "Transaction",
      entityId: transactionId,
    });
    return { ok: false, reason: "invalid-password" };
  }

  return completeVerification(userId, transactionId, transaction, "PASSWORD");
}

/**
 * Same as {@link verifyIdentityWithPassword}, but for the WebAuthn
 * biometric path — the assertion itself must already have been verified by
 * the caller (`finishAuthentication`) before this is invoked.
 */
export async function markIdentityVerifiedByWebAuthn(
  userId: string,
  transactionId: string
): Promise<
  | { ok: true; otpChallengeId: string; otpDemoCode?: string }
  | { ok: false; reason: VerificationActionFailure }
> {
  const transaction = await loadSession(userId, transactionId);
  if (!transaction) return { ok: false, reason: "not-found" };
  if (transaction.riskAssessment!.verificationStatus !== "PENDING") {
    return { ok: false, reason: "not-pending" };
  }
  if (
    transaction.riskAssessment!.verificationExpiresAt &&
    transaction.riskAssessment!.verificationExpiresAt < new Date()
  ) {
    return { ok: false, reason: "expired" };
  }

  return completeVerification(userId, transactionId, transaction, "WEBAUTHN");
}

async function completeVerification(
  userId: string,
  transactionId: string,
  transaction: NonNullable<Awaited<ReturnType<typeof loadSession>>>,
  method: "PASSWORD" | "WEBAUTHN"
): Promise<{ ok: true; otpChallengeId: string; otpDemoCode?: string }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  await prisma.riskAssessment.update({
    where: { id: transaction.riskAssessment!.id },
    data: { verificationStatus: "VERIFIED" },
  });
  await logAuditEvent({
    userId,
    action: "VERIFICATION_IDENTITY_CONFIRMED",
    entityType: "Transaction",
    entityId: transactionId,
    metadata: { method },
  });

  const challenge = await createOtpChallenge({
    userId,
    userEmail: user.email,
    transactionId,
    amount: Number(transaction.amount),
    merchant: transaction.merchant,
    beneficiary: transaction.beneficiary,
  });

  return { ok: true, otpChallengeId: challenge.challengeId, otpDemoCode: challenge.demoCode };
}
