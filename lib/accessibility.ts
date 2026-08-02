import type { UiLocale } from "@prisma/client";

export type AccessibilityPreferences = {
  seniorMode: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  voiceResponses: boolean;
  uiLocale: UiLocale;
  a11yOnboardingSeen: boolean;
};

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  seniorMode: false,
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  voiceResponses: false,
  uiLocale: "EN",
  a11yOnboardingSeen: false,
};

export const A11Y_COOKIE_NAME = "persona-a11y";

/** BCP-47 tags for Web Speech API STT/TTS. */
export function uiLocaleToSpeechLang(locale: UiLocale): string {
  switch (locale) {
    case "HI":
      return "hi-IN";
    case "PA":
      return "pa-IN";
    case "EN":
    default:
      return "en-IN";
  }
}

export function uiLocaleLabel(locale: UiLocale): string {
  switch (locale) {
    case "HI":
      return "Hindi";
    case "PA":
      return "Punjabi";
    case "EN":
    default:
      return "English";
  }
}

/**
 * When Senior Mode is turned on, cascade the core profile flags.
 * Individual toggles remain editable afterward.
 */
export function cascadeSeniorModeOn(
  prefs: AccessibilityPreferences
): AccessibilityPreferences {
  return {
    ...prefs,
    seniorMode: true,
    largeText: true,
    highContrast: true,
    voiceResponses: true,
  };
}

export function serializeA11yCookie(prefs: AccessibilityPreferences): string {
  return JSON.stringify({
    s: prefs.seniorMode ? 1 : 0,
    lt: prefs.largeText ? 1 : 0,
    hc: prefs.highContrast ? 1 : 0,
    rm: prefs.reducedMotion ? 1 : 0,
    vr: prefs.voiceResponses ? 1 : 0,
    l: prefs.uiLocale,
  });
}

export function parseA11yCookie(raw: string | undefined | null): AccessibilityPreferences | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as {
      s?: number;
      lt?: number;
      hc?: number;
      rm?: number;
      vr?: number;
      l?: string;
    };
    const locale: UiLocale =
      data.l === "HI" || data.l === "PA" || data.l === "EN" ? data.l : "EN";
    return {
      seniorMode: Boolean(data.s),
      largeText: Boolean(data.lt),
      highContrast: Boolean(data.hc),
      reducedMotion: Boolean(data.rm),
      voiceResponses: Boolean(data.vr),
      uiLocale: locale,
      a11yOnboardingSeen: true,
    };
  } catch {
    return null;
  }
}

export function applyA11yDocumentAttrs(prefs: AccessibilityPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.toggleAttribute("data-a11y-senior", prefs.seniorMode);
  root.toggleAttribute("data-a11y-large-text", prefs.largeText);
  root.toggleAttribute("data-a11y-high-contrast", prefs.highContrast);
  root.toggleAttribute("data-a11y-reduced-motion", prefs.reducedMotion);
  root.toggleAttribute("data-a11y-voice", prefs.voiceResponses);
  root.dataset.a11yLocale = prefs.uiLocale;
}

export function writeA11yCookie(prefs: AccessibilityPreferences): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(serializeA11yCookie(prefs));
  document.cookie = `${A11Y_COOKIE_NAME}=${value}; path=/; max-age=31536000; samesite=lax`;
}
