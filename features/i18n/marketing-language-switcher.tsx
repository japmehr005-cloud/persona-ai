"use client";

import { useTranslations } from "next-intl";

import { useAppLocale } from "@/features/i18n/app-i18n-provider";
import type { AppLocale } from "@/i18n/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

/** Compact language control for login/register (cookie-persisted, no auth required). */
export function MarketingLanguageSwitcher() {
  const t = useTranslations("common");
  const { locale, setLocale } = useAppLocale();

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="marketing-locale" className="sr-only">
        {t("language")}
      </Label>
      <Select value={locale} onValueChange={(value) => setLocale(value as AppLocale)}>
        <SelectTrigger id="marketing-locale" className="h-10 w-[140px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t("english")}</SelectItem>
          <SelectItem value="hi">{t("hindi")}</SelectItem>
          <SelectItem value="pa">{t("punjabi")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
