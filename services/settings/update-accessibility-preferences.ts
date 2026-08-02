import { prisma } from "@/lib/prisma";
import type { UiLocale } from "@prisma/client";
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  type AccessibilityPreferences,
} from "@/lib/accessibility";

export type { AccessibilityPreferences };
export { DEFAULT_ACCESSIBILITY_PREFERENCES };

export type UpdateAccessibilityPreferencesInput = Partial<AccessibilityPreferences>;

/**
 * Upserts accessibility preferences. Callers decide cascade rules
 * (e.g. Senior Mode enabling large text) before invoking this.
 */
export async function updateAccessibilityPreferences(
  userId: string,
  input: UpdateAccessibilityPreferencesInput
): Promise<AccessibilityPreferences> {
  const row = await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      seniorMode: input.seniorMode ?? DEFAULT_ACCESSIBILITY_PREFERENCES.seniorMode,
      largeText: input.largeText ?? DEFAULT_ACCESSIBILITY_PREFERENCES.largeText,
      highContrast: input.highContrast ?? DEFAULT_ACCESSIBILITY_PREFERENCES.highContrast,
      reducedMotion: input.reducedMotion ?? DEFAULT_ACCESSIBILITY_PREFERENCES.reducedMotion,
      voiceResponses: input.voiceResponses ?? DEFAULT_ACCESSIBILITY_PREFERENCES.voiceResponses,
      uiLocale: (input.uiLocale ?? DEFAULT_ACCESSIBILITY_PREFERENCES.uiLocale) as UiLocale,
      a11yOnboardingSeen:
        input.a11yOnboardingSeen ?? DEFAULT_ACCESSIBILITY_PREFERENCES.a11yOnboardingSeen,
    },
    update: input,
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

  return row;
}
