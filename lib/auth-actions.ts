"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";

import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { homePathForRole } from "@/lib/roles";
import {
  createTotpLoginChallenge,
  getPendingTotpLoginChallenge,
  createWebAuthnLoginChallenge,
  getPendingWebAuthnLoginChallenge,
} from "@/services/auth/login-challenge";
import { createLoginOtpChallenge } from "@/services/auth/login-otp";
import { buildAuthenticationOptions } from "@/services/auth/webauthn";
import { scoreLogin } from "@/services/risk-engine/score-login";
import { recordFinEvent } from "@/services/fin/fin-event-logger";

const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

async function getRequestIpAddress(): Promise<string | null> {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    null
  );
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

const requestedAuthMethodSchema = z
  .enum(["PASSWORD_OTP", "PASSWORD_BIOMETRIC", "AUTHENTICATOR"])
  .optional();

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  fingerprintHash: z.string().optional(),
  /** Session-scoped method from the login chooser — does not persist to settings. */
  requestedAuthMethod: requestedAuthMethodSchema,
});

export interface LoginActionState {
  error?: string;
  /** When set, the client should run the Face ID / fingerprint simulation step. */
  demoBiometricToken?: string;
}

/**
 * Adaptive Authentication's login entry point. Password is always checked
 * first (so a wrong password never reveals which second factor an account
 * uses), then the flow branches by session-scoped `requestedAuthMethod`
 * (login chooser) or the customer's saved preference:
 *
 *  1. Authenticator/TOTP already enabled → `/login/verify-2fa` (mandatory).
 *  2. Password + Biometric → WebAuthn, or demo biometric simulation token.
 *  3. Password + OTP / Authenticator (no TOTP yet) / login-risk step-up → OTP.
 *  4. Otherwise → complete sign-in immediately.
 */
export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const requestedRaw = formData.get("requestedAuthMethod");
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fingerprintHash: formData.get("fingerprintHash") || undefined,
    requestedAuthMethod:
      typeof requestedRaw === "string" && requestedRaw.length > 0 ? requestedRaw : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials." };
  }

  const rateLimit = checkRateLimit(
    `login:${parsed.data.email.toLowerCase()}`,
    LOGIN_ATTEMPT_LIMIT,
    LOGIN_ATTEMPT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return { error: "Too many login attempts. Please wait a few minutes and try again." };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: {
      twoFactorCredential: { select: { enabled: true } },
      webAuthnCredentials: { select: { id: true } },
      settings: { select: { preferredAuthMethod: true } },
    },
  });
  if (!user) {
    // No account — fall through to signIn() below, which will fail the
    // same way a wrong password does, so account existence is never leaked.
    return signInWithPassword(parsed.data.email, parsed.data.password);
  }

  const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordValid) {
    return signInWithPassword(parsed.data.email, parsed.data.password);
  }

  // Outcome 1 — TOTP enrolled is always mandatory (Authenticator path).
  if (user.twoFactorCredential?.enabled) {
    const token = await createTotpLoginChallenge(user.id);
    redirect(`/login/verify-2fa?token=${token}`);
  }

  const ipAddress = await getRequestIpAddress();
  const effectiveMethod =
    parsed.data.requestedAuthMethod ?? user.settings?.preferredAuthMethod ?? null;

  // Outcome 2 — Password + Biometrics.
  if (effectiveMethod === "PASSWORD_BIOMETRIC") {
    if (user.webAuthnCredentials.length > 0) {
      const token = await createWebAuthnLoginChallenge(user.id);
      redirect(`/login/verify-webauthn?token=${token}`);
    }
    // Demo / devices without a registered authenticator — client simulates
    // Face ID / fingerprint, then completes via completeDemoBiometricLoginAction.
    const token = await createWebAuthnLoginChallenge(user.id);
    return { demoBiometricToken: token };
  }

  const loginRisk = await scoreLogin({
    userId: user.id,
    deviceFingerprintHash: parsed.data.fingerprintHash ?? null,
    ipAddress,
  });

  // Outcome 3 — OTP (explicit chooser, saved preference, Authenticator without
  // TOTP enrollment yet, or risk-driven step-up).
  const wantsOtp =
    effectiveMethod === "PASSWORD_OTP" ||
    effectiveMethod === "AUTHENTICATOR" ||
    loginRisk.requiresStepUp;

  if (wantsOtp) {
    if (effectiveMethod === null && loginRisk.requiresStepUp) {
      await recordFinEvent({
        type: "LOGIN_STEP_UP_REQUIRED",
        severity: loginRisk.score >= 60 ? "HIGH" : "MEDIUM",
        userId: user.id,
        ipAddress,
        summary: `Sign-in for ${user.email} required a one-time code step-up (risk score ${loginRisk.score}).`,
        metadata: { reasons: loginRisk.reasons, score: loginRisk.score },
      });
    }

    const challenge = await createLoginOtpChallenge(
      user.id,
      user.email,
      parsed.data.fingerprintHash ?? null
    );
    const query = new URLSearchParams({ challengeId: challenge.challengeId });
    if (challenge.demoCode) query.set("demoCode", challenge.demoCode);
    redirect(`/login/verify-otp?${query.toString()}`);
  }

  // Outcome 4 — same single-step signIn as before Phase 1.
  return signInWithPassword(parsed.data.email, parsed.data.password);
}

/**
 * Completes the demo Face ID / fingerprint simulation after password was
 * verified and a WEBAUTHN_LOGIN challenge was issued (no hardware credential).
 */
export async function completeDemoBiometricLoginAction(input: {
  token: string;
  email: string;
  password: string;
}): Promise<LoginActionState> {
  const challenge = await getPendingWebAuthnLoginChallenge(input.token);
  if (!challenge) {
    return { error: "That biometric sign-in session expired. Please sign in again." };
  }

  if (challenge.userEmail.toLowerCase() !== input.email.toLowerCase()) {
    return { error: "Biometric session does not match this account." };
  }

  const passwordValid = await bcrypt.compare(
    input.password,
    (
      await prisma.user.findUniqueOrThrow({
        where: { id: challenge.userId },
        select: { passwordHash: true },
      })
    ).passwordHash
  );
  if (!passwordValid) {
    return { error: "Invalid email or password." };
  }

  await prisma.pendingAuthChallenge.updateMany({
    where: { token: input.token, consumed: false },
    data: { consumed: true },
  });

  return signInWithPassword(input.email, input.password);
}

async function resolvePostLoginPath(input: { email?: string; userId?: string }): Promise<string> {
  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { role: true } });
    return homePathForRole(user?.role);
  }
  if (input.email) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { role: true },
    });
    return homePathForRole(user?.role);
  }
  return "/dashboard";
}

async function signInWithPassword(email: string, password: string): Promise<LoginActionState> {
  try {
    const redirectTo = await resolvePostLoginPath({ email });
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
  return {};
}

export interface VerifyTwoFactorActionState {
  error?: string;
}

const verifyTwoFactorSchema = z.object({
  token: z.string().min(1),
  code: z.string().min(6, "Enter the 6-digit code from your authenticator app.").max(8),
});

export async function verifyTwoFactorLoginAction(
  _prevState: VerifyTwoFactorActionState,
  formData: FormData
): Promise<VerifyTwoFactorActionState> {
  const parsed = verifyTwoFactorSchema.safeParse({
    token: formData.get("token"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid code." };
  }

  const challenge = await getPendingTotpLoginChallenge(parsed.data.token);
  if (!challenge) {
    return { error: "This sign-in session has expired. Please sign in again." };
  }

  const rateLimit = checkRateLimit(`2fa-login:${challenge.userId}`, 8, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  try {
    const redirectTo = await resolvePostLoginPath({ userId: challenge.userId });
    await signIn("credentials", {
      challengeToken: parsed.data.token,
      code: parsed.data.code,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid or expired code. Please try again." };
    }
    throw error;
  }

  return {};
}

export interface VerifyLoginOtpActionState {
  error?: string;
}

const verifyLoginOtpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().length(6, "Enter the 6-digit code.").regex(/^\d{6}$/, "Enter the 6-digit code."),
  deviceFingerprintHash: z.string().optional(),
});

/**
 * Adaptive Authentication Option 1 (Password + OTP) — step 2. Re-verifies
 * the code inside `authorize()` via `verifyLoginOtpChallenge`, exactly like
 * the TOTP branch above; this action only forwards the form values.
 */
export async function verifyLoginOtpAction(
  _prevState: VerifyLoginOtpActionState,
  formData: FormData
): Promise<VerifyLoginOtpActionState> {
  const parsed = verifyLoginOtpSchema.safeParse({
    challengeId: formData.get("challengeId"),
    code: formData.get("code"),
    deviceFingerprintHash: formData.get("deviceFingerprintHash") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid code." };
  }

  const rateLimit = checkRateLimit(`otp-login:${parsed.data.challengeId}`, 8, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  try {
    const otpChallenge = await prisma.otpChallenge.findFirst({
      where: { id: parsed.data.challengeId, purpose: "LOGIN" },
      select: { userId: true },
    });
    const redirectTo = await resolvePostLoginPath({ userId: otpChallenge?.userId });
    await signIn("credentials", {
      otpChallengeId: parsed.data.challengeId,
      otpCode: parsed.data.code,
      otpDeviceFingerprintHash: parsed.data.deviceFingerprintHash,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid or expired code. Please try again." };
    }
    throw error;
  }

  return {};
}

/** Adaptive Authentication Option 2 (Password + Biometric) — step 2a:
 * hands the client the WebAuthn assertion options for the user this
 * pending challenge belongs to. */
export async function startWebAuthnLoginAction(
  token: string
): Promise<
  | { ok: true; options: PublicKeyCredentialRequestOptionsJSON }
  | { ok: false; error: string }
> {
  const challenge = await getPendingWebAuthnLoginChallenge(token);
  if (!challenge) {
    return { ok: false, error: "This sign-in session has expired. Please sign in again." };
  }

  const rateLimit = checkRateLimit(`webauthn-login-start:${challenge.userId}`, 10, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const options = await buildAuthenticationOptions(challenge.userId);
  return { ok: true, options };
}

export interface WebAuthnLoginActionState {
  error?: string;
}

/** Adaptive Authentication Option 2 (Password + Biometric) — step 2b:
 * re-verifies the signed assertion inside `authorize()`, exactly like the
 * TOTP/OTP branches above. */
export async function finishWebAuthnLoginAction(
  token: string,
  assertion: AuthenticationResponseJSON
): Promise<WebAuthnLoginActionState> {
  try {
    const challenge = await getPendingWebAuthnLoginChallenge(token);
    const redirectTo = await resolvePostLoginPath({ userId: challenge?.userId });
    await signIn("credentials", {
      webauthnChallengeToken: token,
      webauthnAssertion: JSON.stringify(assertion),
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Biometric verification failed. Please try again or use another method." };
    }
    throw error;
  }

  return {};
}

/**
 * Fallback from `/login/verify-webauthn`: lets a user who can't complete
 * biometric verification (no fingerprint sensor available, cancelled
 * prompt, etc.) fall back to a Password + OTP code instead, without
 * re-entering their password. The original WebAuthn challenge is consumed
 * so it can't be replayed after the switch. Returns the new destination
 * instead of calling `redirect()` itself, matching how every other
 * client-invoked (non-form) action in this codebase hands navigation back
 * to the caller (see `HighRiskVerificationPanel`'s `goToOtp`).
 */
export async function switchToOtpLoginAction(
  token: string
): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const challenge = await getPendingWebAuthnLoginChallenge(token);
  if (!challenge) {
    return { ok: false, error: "This sign-in session has expired. Please sign in again." };
  }

  await prisma.pendingAuthChallenge.updateMany({
    where: { token, consumed: false },
    data: { consumed: true },
  });

  const otpChallenge = await createLoginOtpChallenge(challenge.userId, challenge.userEmail);
  const query = new URLSearchParams({ challengeId: otpChallenge.challengeId });
  if (otpChallenge.demoCode) query.set("demoCode", otpChallenge.demoCode);
  return { ok: true, redirectTo: `/login/verify-otp?${query.toString()}` };
}

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export interface RegisterActionState {
  error?: string;
}

export async function registerAction(
  _prevState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      accounts: {
        create: {
          name: "Primary Checking",
          mask: "0000",
          type: "CHECKING",
          balance: 0,
        },
      },
    },
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  }

  return {};
}

export async function demoLoginAction() {
  const demoUser = await prisma.user.findFirst({
    where: { isDemo: true, role: "CUSTOMER" },
    orderBy: { createdAt: "asc" },
  });

  if (!demoUser) {
    redirect("/login?error=demo-unavailable");
  }

  try {
    await signIn("credentials", {
      email: demoUser.email,
      password: "demo-password",
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=demo-unavailable");
    }
    throw error;
  }
}
