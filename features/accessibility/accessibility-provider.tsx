"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  applyA11yDocumentAttrs,
  cascadeSeniorModeOn,
  writeA11yCookie,
  type AccessibilityPreferences,
} from "@/lib/accessibility";
import { updateAccessibilityPreferencesAction } from "@/features/settings/settings-actions";
import { useAppLocaleOptional } from "@/features/i18n/app-i18n-provider";
import {
  appLocaleToUiLocale,
  isAppLocale,
  LOCALE_COOKIE_NAME,
  uiLocaleToAppLocale,
} from "@/i18n/config";

type AccessibilityContextValue = AccessibilityPreferences & {
  setPreferences: (next: AccessibilityPreferences, options?: { persist?: boolean }) => void;
  updatePreferences: (patch: Partial<AccessibilityPreferences>) => Promise<boolean>;
  enableSeniorMode: () => Promise<boolean>;
  isSaving: boolean;
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({
  initial,
  children,
}: {
  initial: AccessibilityPreferences;
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useState<AccessibilityPreferences>(initial);
  const [isSaving, startTransition] = useTransition();
  const i18n = useAppLocaleOptional();

  useEffect(() => {
    setPrefs(initial);
    applyA11yDocumentAttrs(initial);
    writeA11yCookie(initial);

    // Honor a language chosen on login/register (NEXT_LOCALE cookie) when the
    // DB preference is still the English default — then persist it.
    const cookieMatch = document.cookie.match(
      new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]*)`)
    );
    const cookieLocale = cookieMatch?.[1];
    const dbLocale = uiLocaleToAppLocale(initial.uiLocale);

    if (
      isAppLocale(cookieLocale) &&
      cookieLocale !== dbLocale &&
      initial.uiLocale === "EN" &&
      cookieLocale !== "en"
    ) {
      const next: AccessibilityPreferences = {
        ...initial,
        uiLocale: appLocaleToUiLocale(cookieLocale),
      };
      setPrefs(next);
      writeA11yCookie(next);
      i18n?.setLocale(cookieLocale);
      void updateAccessibilityPreferencesAction(next);
    } else {
      i18n?.setLocaleFromUiLocale(initial.uiLocale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from server initial only
  }, [initial]);

  useEffect(() => {
    applyA11yDocumentAttrs(prefs);
  }, [prefs]);

  const setPreferences = useCallback(
    (next: AccessibilityPreferences, options?: { persist?: boolean }) => {
      setPrefs(next);
      applyA11yDocumentAttrs(next);
      writeA11yCookie(next);
      i18n?.setLocaleFromUiLocale(next.uiLocale);
      if (options?.persist === false) return;
    },
    [i18n]
  );

  const updatePreferences = useCallback(async (patch: Partial<AccessibilityPreferences>) => {
    let next = { ...prefs, ...patch, a11yOnboardingSeen: true };
    if (patch.seniorMode === true && !prefs.seniorMode) {
      next = cascadeSeniorModeOn(next);
    }
    setPrefs(next);
    applyA11yDocumentAttrs(next);
    writeA11yCookie(next);
    i18n?.setLocaleFromUiLocale(next.uiLocale);

    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const response = await updateAccessibilityPreferencesAction(next);
        if (!response.ok) {
          setPrefs(prefs);
          applyA11yDocumentAttrs(prefs);
          writeA11yCookie(prefs);
          i18n?.setLocaleFromUiLocale(prefs.uiLocale);
          resolve(false);
          return;
        }
        setPrefs(response.data);
        applyA11yDocumentAttrs(response.data);
        writeA11yCookie(response.data);
        i18n?.setLocaleFromUiLocale(response.data.uiLocale);
        resolve(true);
      });
    });
  }, [prefs, i18n]);

  const enableSeniorMode = useCallback(async () => {
    return updatePreferences({ seniorMode: true });
  }, [updatePreferences]);

  const value = useMemo<AccessibilityContextValue>(
    () => ({
      ...prefs,
      setPreferences,
      updatePreferences,
      enableSeniorMode,
      isSaving,
    }),
    [prefs, setPreferences, updatePreferences, enableSeniorMode, isSaving]
  );

  return (
    <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return ctx;
}

/** Safe hook for components that may render outside the customer shell. */
export function useAccessibilityOptional(): AccessibilityContextValue | null {
  return useContext(AccessibilityContext);
}
