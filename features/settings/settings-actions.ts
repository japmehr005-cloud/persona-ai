"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { updateProfile } from "@/services/settings/update-profile";
import { updateSecurityPreferences } from "@/services/settings/update-security-preferences";
import { updateRiskEngineSettings } from "@/services/settings/update-risk-engine-settings";
import { updateDeveloperSettings } from "@/services/settings/update-developer-settings";
import { updatePreferredAuthMethod } from "@/services/settings/update-auth-method";
import {
  updateAccessibilityPreferences,
  type AccessibilityPreferences,
} from "@/services/settings/update-accessibility-preferences";
import {
  A11Y_COOKIE_NAME,
  cascadeSeniorModeOn,
  serializeA11yCookie,
} from "@/lib/accessibility";
import { LOCALE_COOKIE_NAME, uiLocaleToAppLocale } from "@/i18n/config";
import { logoutAllDevices } from "@/services/settings/logout-all-devices";
import { resetDemoData, ResetDemoDataError } from "@/services/settings/reset-demo-data";
import { RISK_THRESHOLD_BOUNDS } from "@/lib/constants";
import { cookies } from "next/headers";
import {
  confirmTotpEnrollment,
  disableTotp,
  startTotpEnrollment,
  type TotpEnrollmentView,
} from "@/services/auth/totp";
import {
  buildRegistrationOptions,
  finishRegistration,
  removeWebAuthnCredential,
} from "@/services/auth/webauthn";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+\s()-]*$/, "Enter a valid phone number.")
    .optional(),
  organization: z.string().trim().max(120).optional(),
});

export async function updateProfileAction(input: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile details." };
  }

  await updateProfile(user.id, {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone || null,
    organization: parsed.data.organization || null,
  });

  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

const securityPreferencesSchema = z.object({
  emailAlertsEnabled: z.boolean(),
  smsAlertsEnabled: z.boolean(),
});

export async function updateSecurityPreferencesAction(
  input: z.infer<typeof securityPreferencesSchema>
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = securityPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid security preferences." };
  }

  await updateSecurityPreferences(user.id, parsed.data);
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

const riskEngineSchema = z.object({
  adaptiveLearningEnabled: z.boolean(),
  mediumRiskThreshold: z.number().int().min(RISK_THRESHOLD_BOUNDS.medium.min).max(RISK_THRESHOLD_BOUNDS.medium.max),
  highRiskThreshold: z.number().int().min(RISK_THRESHOLD_BOUNDS.high.min).max(RISK_THRESHOLD_BOUNDS.high.max),
  riskEngineDemoMode: z.boolean(),
});

export async function updateRiskEngineSettingsAction(
  input: z.infer<typeof riskEngineSchema>
): Promise<ActionResult<{ mediumRiskThreshold: number; highRiskThreshold: number }>> {
  const user = await requireUser();
  const parsed = riskEngineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid risk engine settings." };
  }

  const thresholds = await updateRiskEngineSettings(user.id, parsed.data);
  revalidatePath("/settings");
  revalidatePath("/dev/context-simulator");
  return { ok: true, data: thresholds };
}

const developerSettingsSchema = z.object({ showRiskDebugPanel: z.boolean() });

export async function updateDeveloperSettingsAction(
  input: z.infer<typeof developerSettingsSchema>
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = developerSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid developer settings." };
  }

  await updateDeveloperSettings(user.id, parsed.data.showRiskDebugPanel);
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

const accessibilitySchema = z.object({
  seniorMode: z.boolean(),
  largeText: z.boolean(),
  highContrast: z.boolean(),
  reducedMotion: z.boolean(),
  voiceResponses: z.boolean(),
  uiLocale: z.enum(["EN", "HI", "PA"]),
  a11yOnboardingSeen: z.boolean().optional(),
});

async function persistA11yCookie(prefs: AccessibilityPreferences): Promise<void> {
  const jar = await cookies();
  jar.set(A11Y_COOKIE_NAME, serializeA11yCookie(prefs), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  jar.set(LOCALE_COOKIE_NAME, uiLocaleToAppLocale(prefs.uiLocale), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
}

export async function updateAccessibilityPreferencesAction(
  input: z.infer<typeof accessibilitySchema>
): Promise<ActionResult<AccessibilityPreferences>> {
  const user = await requireUser();
  const parsed = accessibilitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid accessibility preferences." };
  }

  // Cascade is applied client-side when Senior Mode is toggled on so users
  // can still turn individual options off afterward without being overwritten.
  const next: AccessibilityPreferences = {
    seniorMode: parsed.data.seniorMode,
    largeText: parsed.data.largeText,
    highContrast: parsed.data.highContrast,
    reducedMotion: parsed.data.reducedMotion,
    voiceResponses: parsed.data.voiceResponses,
    uiLocale: parsed.data.uiLocale,
    a11yOnboardingSeen: parsed.data.a11yOnboardingSeen ?? true,
  };

  const saved = await updateAccessibilityPreferences(user.id, next);
  await persistA11yCookie(saved);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/assistant");
  return { ok: true, data: saved };
}

/** First-login modal: Enable Senior Mode or dismiss permanently. */
export async function completeA11yOnboardingAction(
  enableSeniorMode: boolean
): Promise<ActionResult<AccessibilityPreferences>> {
  const user = await requireUser();
  const existing = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: {
      seniorMode: true,
      largeText: true,
      highContrast: true,
      reducedMotion: true,
      voiceResponses: true,
      uiLocale: true,
      a11yOnboardingSeen: true,
    },
  });

  let next: AccessibilityPreferences = {
    seniorMode: existing?.seniorMode ?? false,
    largeText: existing?.largeText ?? false,
    highContrast: existing?.highContrast ?? false,
    reducedMotion: existing?.reducedMotion ?? false,
    voiceResponses: existing?.voiceResponses ?? false,
    uiLocale: existing?.uiLocale ?? "EN",
    a11yOnboardingSeen: true,
  };

  if (enableSeniorMode) {
    next = cascadeSeniorModeOn(next);
  }

  const saved = await updateAccessibilityPreferences(user.id, next);
  await persistA11yCookie(saved);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/assistant");
  return { ok: true, data: saved };
}

const TOTP_ENROLLMENT_LIMIT = 5;
const TOTP_ENROLLMENT_WINDOW_MS = 10 * 60 * 1000;

export async function startTotpEnrollmentAction(): Promise<ActionResult<TotpEnrollmentView>> {
  const user = await requireUser();

  const rateLimit = checkRateLimit(`totp-enroll:${user.id}`, TOTP_ENROLLMENT_LIMIT, TOTP_ENROLLMENT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const enrollment = await startTotpEnrollment(user.id, user.email ?? user.id);
  return { ok: true, data: enrollment };
}

const totpCodeSchema = z.object({ code: z.string().trim().min(6).max(8) });

export async function confirmTotpEnrollmentAction(input: { code: string }): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter the 6-digit code from your authenticator app." };
  }

  const rateLimit = checkRateLimit(`totp-confirm:${user.id}`, TOTP_ENROLLMENT_LIMIT, TOTP_ENROLLMENT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const result = await confirmTotpEnrollment(user.id, parsed.data.code);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "NOT_STARTED"
          ? "Start enrollment again before confirming a code."
          : "That code doesn't match. Check your authenticator app and try again.",
    };
  }

  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

export async function disableTotpAction(input: { code: string }): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = totpCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter the 6-digit code from your authenticator app." };
  }

  const rateLimit = checkRateLimit(`totp-disable:${user.id}`, TOTP_ENROLLMENT_LIMIT, TOTP_ENROLLMENT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const result = await disableTotp(user.id, parsed.data.code);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "NOT_ENABLED"
          ? "Two-factor authentication is not enabled."
          : "That code doesn't match. Check your authenticator app and try again.",
    };
  }

  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

const authMethodSchema = z.object({
  method: z.enum(["PASSWORD_OTP", "PASSWORD_BIOMETRIC", "AUTHENTICATOR"]).nullable(),
});

/**
 * Adaptive Authentication — sets the customer's preferred sign-in method.
 * The Risk Engine's login-risk score can still force a stronger method for
 * a suspicious login; it never relaxes below this preference.
 */
export async function updatePreferredAuthMethodAction(
  input: z.infer<typeof authMethodSchema>
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = authMethodSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid sign-in method." };
  }

  if (parsed.data.method === "PASSWORD_BIOMETRIC") {
    const credentialCount = await prisma.webAuthnCredential.count({ where: { userId: user.id } });
    if (credentialCount === 0) {
      return { ok: false, error: "Register a biometric device below before selecting this method." };
    }
  }

  if (parsed.data.method === "AUTHENTICATOR") {
    const totp = await prisma.twoFactorCredential.findUnique({ where: { userId: user.id }, select: { enabled: true } });
    if (!totp?.enabled) {
      return { ok: false, error: "Set up your authenticator app below before selecting this method." };
    }
  }

  await updatePreferredAuthMethod(user.id, parsed.data.method);
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

const WEBAUTHN_LIMIT = 5;
const WEBAUTHN_WINDOW_MS = 10 * 60 * 1000;

export async function startWebAuthnRegistrationAction(): Promise<ActionResult<PublicKeyCredentialCreationOptionsJSON>> {
  const user = await requireUser();

  const rateLimit = checkRateLimit(`webauthn-reg-start:${user.id}`, WEBAUTHN_LIMIT, WEBAUTHN_WINDOW_MS);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const options = await buildRegistrationOptions(user.id, user.email ?? user.id, user.name ?? user.email ?? user.id);
  return { ok: true, data: options };
}

const finishRegistrationSchema = z.object({ deviceLabel: z.string().trim().min(1).max(60) });

export async function finishWebAuthnRegistrationAction(
  response: RegistrationResponseJSON,
  input: { deviceLabel: string }
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = finishRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a name for this device." };
  }

  const rateLimit = checkRateLimit(`webauthn-reg-finish:${user.id}`, WEBAUTHN_LIMIT, WEBAUTHN_WINDOW_MS);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const result = await finishRegistration(user.id, response, parsed.data.deviceLabel);
  if (!result.ok) {
    return { ok: false, error: "Could not verify that device. Please try again." };
  }

  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

export async function removeWebAuthnCredentialAction(credentialId: string): Promise<ActionResult> {
  const user = await requireUser();
  const removed = await removeWebAuthnCredential(user.id, credentialId);
  if (!removed) {
    return { ok: false, error: "That credential could not be found." };
  }

  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

const LOGOUT_ALL_LIMIT = 5;
const LOGOUT_ALL_WINDOW_MS = 10 * 60 * 1000;

export async function logoutAllDevicesAction(): Promise<ActionResult> {
  const user = await requireUser();

  const rateLimit = checkRateLimit(`logout-all:${user.id}`, LOGOUT_ALL_LIMIT, LOGOUT_ALL_WINDOW_MS);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  await logoutAllDevices(user.id);
  revalidatePath("/settings");
  revalidatePath("/security/devices");
  return { ok: true, data: undefined };
}

const RESET_DEMO_DATA_LIMIT = 5;
const RESET_DEMO_DATA_WINDOW_MS = 10 * 60 * 1000;

export async function resetDemoDataAction(): Promise<ActionResult<{ importedCount: number }>> {
  const user = await requireUser();

  if (!user.isDemo) {
    return { ok: false, error: "Test data reset is only available for demo accounts." };
  }

  const rateLimit = checkRateLimit(`reset-demo-data:${user.id}`, RESET_DEMO_DATA_LIMIT, RESET_DEMO_DATA_WINDOW_MS);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many resets requested recently. Please wait a few minutes and try again." };
  }

  try {
    const result = await resetDemoData(user.id);
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/alerts");
    revalidatePath("/security/behavior");
    revalidatePath("/settings");
    return { ok: true, data: result };
  } catch (error) {
    const message = error instanceof ResetDemoDataError || error instanceof Error
      ? error.message
      : "Failed to reset demo data.";
    return { ok: false, error: message };
  }
}
