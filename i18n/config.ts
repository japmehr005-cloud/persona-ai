import type { UiLocale } from "@prisma/client";

export const locales = ["en", "hi", "pa"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "en" || value === "hi" || value === "pa";
}

export function uiLocaleToAppLocale(locale: UiLocale | string | null | undefined): AppLocale {
  switch (locale) {
    case "HI":
    case "hi":
      return "hi";
    case "PA":
    case "pa":
      return "pa";
    case "EN":
    case "en":
    default:
      return "en";
  }
}

export function appLocaleToUiLocale(locale: AppLocale): UiLocale {
  switch (locale) {
    case "hi":
      return "HI";
    case "pa":
      return "PA";
    case "en":
    default:
      return "EN";
  }
}

export function appLocaleToSpeechLang(locale: AppLocale): string {
  switch (locale) {
    case "hi":
      return "hi-IN";
    case "pa":
      return "pa-IN";
    case "en":
    default:
      return "en-IN";
  }
}

export function appLocaleToHtmlLang(locale: AppLocale): string {
  switch (locale) {
    case "hi":
      return "hi";
    case "pa":
      return "pa";
    case "en":
    default:
      return "en";
  }
}
