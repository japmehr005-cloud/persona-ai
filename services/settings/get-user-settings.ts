import { prisma } from "@/lib/prisma";
import type { PreferredAuthMethod, UiLocale } from "@prisma/client";
import { DEFAULT_HIGH_RISK_THRESHOLD, DEFAULT_MEDIUM_RISK_THRESHOLD } from "@/lib/constants";
import { DEFAULT_ACCESSIBILITY_PREFERENCES } from "@/lib/accessibility";
import { listWebAuthnCredentials, type WebAuthnCredentialView } from "@/services/auth/webauthn";

export interface UserSettingsAccountView {
  id: string;
  name: string;
  mask: string;
  type: string;
  balance: number;
  currency: string;
}

export interface UserSettingsView {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  organization: string | null;
  isDemo: boolean;
  demoModeBuildFlagEnabled: boolean;

  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  twoFactorEnabled: boolean;
  webAuthnCredentialCount: number;
  webAuthnCredentials: WebAuthnCredentialView[];

  /** Adaptive Authentication — the sign-in method the customer has chosen.
   * `null` means "no explicit preference" (password-only, or password + the
   * legacy TOTP flow if already enabled) — see `scoreLogin`/`loginAction`. */
  preferredAuthMethod: PreferredAuthMethod | null;

  adaptiveLearningEnabled: boolean;
  mediumRiskThreshold: number;
  highRiskThreshold: number;
  riskEngineDemoMode: boolean;

  showRiskDebugPanel: boolean;

  seniorMode: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  voiceResponses: boolean;
  uiLocale: UiLocale;
  a11yOnboardingSeen: boolean;

  accounts: UserSettingsAccountView[];
}

/**
 * Reads a complete Settings-page view for a user. `UserSettings` rows are
 * created lazily (on first write, see `services/settings/update-*.ts`), so a
 * user who has never opened Settings before simply falls back to product
 * defaults here rather than requiring a migration-time backfill.
 */
export async function getUserSettingsView(userId: string): Promise<UserSettingsView> {
  const [user, settings, twoFactor, webAuthnCredentials] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { accounts: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.twoFactorCredential.findUnique({ where: { userId }, select: { enabled: true } }),
    listWebAuthnCredentials(userId),
  ]);

  return {
    userId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: settings?.phone ?? null,
    organization: settings?.organization ?? null,
    isDemo: user.isDemo,
    demoModeBuildFlagEnabled: process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED === "true",

    emailAlertsEnabled: settings?.emailAlertsEnabled ?? true,
    smsAlertsEnabled: settings?.smsAlertsEnabled ?? false,
    twoFactorEnabled: twoFactor?.enabled ?? false,
    webAuthnCredentialCount: webAuthnCredentials.length,
    webAuthnCredentials,
    preferredAuthMethod: settings?.preferredAuthMethod ?? null,

    adaptiveLearningEnabled: settings?.adaptiveLearningEnabled ?? true,
    mediumRiskThreshold: settings?.mediumRiskThreshold ?? DEFAULT_MEDIUM_RISK_THRESHOLD,
    highRiskThreshold: settings?.highRiskThreshold ?? DEFAULT_HIGH_RISK_THRESHOLD,
    riskEngineDemoMode: settings?.riskEngineDemoMode ?? false,

    showRiskDebugPanel: settings?.showRiskDebugPanel ?? false,

    seniorMode: settings?.seniorMode ?? DEFAULT_ACCESSIBILITY_PREFERENCES.seniorMode,
    largeText: settings?.largeText ?? DEFAULT_ACCESSIBILITY_PREFERENCES.largeText,
    highContrast: settings?.highContrast ?? DEFAULT_ACCESSIBILITY_PREFERENCES.highContrast,
    reducedMotion: settings?.reducedMotion ?? DEFAULT_ACCESSIBILITY_PREFERENCES.reducedMotion,
    voiceResponses: settings?.voiceResponses ?? DEFAULT_ACCESSIBILITY_PREFERENCES.voiceResponses,
    uiLocale: settings?.uiLocale ?? DEFAULT_ACCESSIBILITY_PREFERENCES.uiLocale,
    a11yOnboardingSeen:
      settings?.a11yOnboardingSeen ?? DEFAULT_ACCESSIBILITY_PREFERENCES.a11yOnboardingSeen,

    accounts: user.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      mask: account.mask,
      type: account.type,
      balance: Number(account.balance),
      currency: account.currency,
    })),
  };
}

/**
 * Whether the Context Signal Simulator / Developer Settings should be
 * available to this user: either the build-wide demo flag is on, or the
 * user has personally enabled Demo Mode from Settings → Risk Engine.
 */
export async function isDemoModeActiveForUser(userId: string): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED === "true") return true;
  const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { riskEngineDemoMode: true } });
  return settings?.riskEngineDemoMode ?? false;
}
