"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { NextIntlClientProvider } from "next-intl";

import {
  appLocaleToHtmlLang,
  appLocaleToUiLocale,
  isAppLocale,
  LOCALE_COOKIE_NAME,
  uiLocaleToAppLocale,
  type AppLocale,
} from "@/i18n/config";
import type { UiLocale } from "@prisma/client";

import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import pa from "@/messages/pa.json";

const MESSAGES = {
  en,
  hi,
  pa,
} as const;

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  setLocaleFromUiLocale: (uiLocale: UiLocale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function writeLocaleCookie(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function AppI18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: string;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(
    isAppLocale(initialLocale) ? initialLocale : "en"
  );

  useEffect(() => {
    if (isAppLocale(initialLocale)) {
      setLocaleState(initialLocale);
    }
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = appLocaleToHtmlLang(locale);
    writeLocaleCookie(locale);
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    writeLocaleCookie(next);
    document.documentElement.lang = appLocaleToHtmlLang(next);
  }, []);

  const setLocaleFromUiLocale = useCallback(
    (uiLocale: UiLocale) => {
      setLocale(uiLocaleToAppLocale(uiLocale));
    },
    [setLocale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, setLocaleFromUiLocale }),
    [locale, setLocale, setLocaleFromUiLocale]
  );

  return (
    <I18nContext.Provider value={value}>
      <NextIntlClientProvider
        locale={locale}
        messages={MESSAGES[locale]}
        timeZone="Asia/Kolkata"
      >
        {children}
      </NextIntlClientProvider>
    </I18nContext.Provider>
  );
}

export function useAppLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useAppLocale must be used within AppI18nProvider");
  }
  return ctx;
}

export function useAppLocaleOptional(): I18nContextValue | null {
  return useContext(I18nContext);
}

export { appLocaleToUiLocale, uiLocaleToAppLocale };
