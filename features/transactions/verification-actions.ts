"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildAuthenticationOptions,
  finishAuthentication,
} from "@/services/auth/webauthn";
import {
  cancelVerificationSession,
  getVerificationSession,
  markIdentityVerifiedByWebAuthn,
  verifyIdentityWithPassword,
  type VerificationActionFailure,
} from "@/services/transactions/verification-session";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/types";

const VERIFICATION_ACTION_LIMIT = 20;
const VERIFICATION_ACTION_WINDOW_MS = 5 * 60 * 1000;

export interface VerificationStepResult {
  ok: boolean;
  reason?: VerificationActionFailure | "rate-limited";
  otpChallengeId?: string;
  otpDemoCode?: string;
}

function rateLimited(userId: string, key: string) {
  return checkRateLimit(`${key}:${userId}`, VERIFICATION_ACTION_LIMIT, VERIFICATION_ACTION_WINDOW_MS);
}

export async function cancelVerificationSessionAction(
  transactionId: string
): Promise<{ ok: boolean; reason?: VerificationActionFailure }> {
  const user = await requireUser();
  if (!rateLimited(user.id, "verify-cancel").allowed) {
    return { ok: false, reason: "not-found" };
  }

  const result = await cancelVerificationSession(user.id, transactionId);

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/alerts");

  return result;
}

export async function startWebAuthnVerificationAction(
  transactionId: string
): Promise<
  | { ok: true; options: PublicKeyCredentialRequestOptionsJSON }
  | { ok: false; reason: VerificationActionFailure | "rate-limited" }
> {
  const user = await requireUser();
  if (!rateLimited(user.id, "verify-webauthn-start").allowed) {
    return { ok: false, reason: "rate-limited" };
  }

  const session = await getVerificationSession(user.id, transactionId);
  if (!session) return { ok: false, reason: "not-found" };
  if (session.status !== "PENDING") return { ok: false, reason: "not-pending" };

  // Reuses the same options builder as WebAuthn login authentication —
  // this is intentionally an equivalent "prove it's really you" ceremony,
  // just gating step-up verification instead of sign-in.
  const options = await buildAuthenticationOptions(user.id);
  return { ok: true, options };
}

const webauthnAssertionSchema = z.object({
  transactionId: z.string().min(1),
  assertion: z.record(z.string(), z.unknown()),
});

export async function finishWebAuthnVerificationAction(
  transactionId: string,
  assertion: AuthenticationResponseJSON,
  deviceFingerprintHash?: string
): Promise<VerificationStepResult> {
  const user = await requireUser();
  if (!rateLimited(user.id, "verify-webauthn-finish").allowed) {
    return { ok: false, reason: "rate-limited" };
  }

  const parsed = webauthnAssertionSchema.safeParse({ transactionId, assertion });
  if (!parsed.success) return { ok: false, reason: "webauthn-failed" };

  const verification = await finishAuthentication(user.id, assertion);
  if (!verification.ok) return { ok: false, reason: "webauthn-failed" };

  const result = await markIdentityVerifiedByWebAuthn(user.id, transactionId, deviceFingerprintHash);

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath(`/transactions/${transactionId}`);

  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, otpChallengeId: result.otpChallengeId, otpDemoCode: result.otpDemoCode };
}

const passwordStepUpSchema = z.object({
  transactionId: z.string().min(1),
  password: z.string().min(1).max(200),
  deviceFingerprintHash: z.string().optional(),
});

export async function verifyPasswordStepUpAction(
  transactionId: string,
  password: string,
  deviceFingerprintHash?: string
): Promise<VerificationStepResult> {
  const user = await requireUser();
  if (!rateLimited(user.id, "verify-password-step-up").allowed) {
    return { ok: false, reason: "rate-limited" };
  }

  const parsed = passwordStepUpSchema.safeParse({ transactionId, password, deviceFingerprintHash });
  if (!parsed.success) return { ok: false, reason: "invalid-password" };

  const result = await verifyIdentityWithPassword(
    user.id,
    transactionId,
    parsed.data.password,
    parsed.data.deviceFingerprintHash
  );

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath(`/transactions/${transactionId}`);

  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, otpChallengeId: result.otpChallengeId, otpDemoCode: result.otpDemoCode };
}
