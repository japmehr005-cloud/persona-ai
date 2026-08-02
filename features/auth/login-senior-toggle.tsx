"use client";

import { useEffect, useState } from "react";
import { Accessibility } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  applyA11yDocumentAttrs,
  cascadeSeniorModeOn,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  parseA11yCookie,
  writeA11yCookie,
  type AccessibilityPreferences,
} from "@/lib/accessibility";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function readCookieRaw(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )persona-a11y=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Senior Mode control on the login screen — writes the same a11y cookie
 * used post-login so large targets and high contrast apply immediately.
 */
export function LoginSeniorToggle() {
  const t = useTranslations("auth");
  const [prefs, setPrefs] = useState<AccessibilityPreferences>(DEFAULT_ACCESSIBILITY_PREFERENCES);

  useEffect(() => {
    const parsed = parseA11yCookie(readCookieRaw());
    if (parsed) setPrefs(parsed);
  }, []);

  const toggle = (enabled: boolean) => {
    const next = enabled
      ? cascadeSeniorModeOn({ ...prefs, a11yOnboardingSeen: true })
      : {
          ...prefs,
          seniorMode: false,
          a11yOnboardingSeen: true,
        };
    setPrefs(next);
    writeA11yCookie(next);
    applyA11yDocumentAttrs(next);
  };

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <Accessibility className="size-4 text-muted-foreground" aria-hidden />
        <Label htmlFor="login-senior-mode" className="text-sm font-medium">
          {t("seniorMode")}
        </Label>
      </div>
      <Switch
        id="login-senior-mode"
        checked={prefs.seniorMode}
        onCheckedChange={toggle}
        aria-label={t("seniorMode")}
      />
    </div>
  );
}
