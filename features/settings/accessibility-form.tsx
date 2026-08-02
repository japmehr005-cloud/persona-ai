"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { UiLocale } from "@prisma/client";

import { useAccessibility } from "@/features/accessibility/accessibility-provider";
import { cascadeSeniorModeOn } from "@/lib/accessibility";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ToggleKey =
  | "seniorMode"
  | "largeText"
  | "highContrast"
  | "reducedMotion"
  | "voiceResponses";

export function AccessibilityForm({
  seniorMode,
  largeText,
  highContrast,
  reducedMotion,
  voiceResponses,
  uiLocale,
}: {
  seniorMode: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  voiceResponses: boolean;
  uiLocale: UiLocale;
}) {
  const t = useTranslations("accessibility");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const a11y = useAccessibility();
  const [values, setValues] = useState({
    seniorMode,
    largeText,
    highContrast,
    reducedMotion,
    voiceResponses,
    uiLocale,
  });
  const [isSaving, setIsSaving] = useState(false);

  const persist = async (next: typeof values) => {
    setIsSaving(true);
    const ok = await a11y.updatePreferences(next);
    setIsSaving(false);
    if (!ok) {
      toast.error(tSettings("accessibilitySaveError"));
      setValues({
        seniorMode: a11y.seniorMode,
        largeText: a11y.largeText,
        highContrast: a11y.highContrast,
        reducedMotion: a11y.reducedMotion,
        voiceResponses: a11y.voiceResponses,
        uiLocale: a11y.uiLocale,
      });
      return;
    }
    toast.success(tSettings("accessibilityUpdated"));
  };

  const handleToggle = async (key: ToggleKey, nextValue: boolean) => {
    let next = { ...values, [key]: nextValue };
    if (key === "seniorMode" && nextValue) {
      const cascaded = cascadeSeniorModeOn({
        ...next,
        a11yOnboardingSeen: true,
      });
      next = {
        seniorMode: cascaded.seniorMode,
        largeText: cascaded.largeText,
        highContrast: cascaded.highContrast,
        reducedMotion: cascaded.reducedMotion,
        voiceResponses: cascaded.voiceResponses,
        uiLocale: cascaded.uiLocale,
      };
    }
    setValues(next);
    await persist(next);
  };

  const handleLocale = async (locale: UiLocale) => {
    const next = { ...values, uiLocale: locale };
    setValues(next);
    await persist(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("seniorModeTitle")}</CardTitle>
          <CardDescription>{t("seniorModeDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-14 items-center justify-between gap-4">
            <Label htmlFor="senior-mode" className="text-base">
              {t("enableSeniorMode")}
            </Label>
            <Switch
              id="senior-mode"
              checked={values.seniorMode}
              disabled={isSaving}
              onCheckedChange={(checked) => handleToggle("seniorMode", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("displayTitle")}</CardTitle>
          <CardDescription>{t("displayDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <PreferenceRow
            id="large-text"
            label={t("largeText")}
            description={t("largeTextDescription")}
            checked={values.largeText}
            disabled={isSaving}
            onCheckedChange={(checked) => handleToggle("largeText", checked)}
          />
          <PreferenceRow
            id="high-contrast"
            label={t("highContrast")}
            description={t("highContrastDescription")}
            checked={values.highContrast}
            disabled={isSaving}
            onCheckedChange={(checked) => handleToggle("highContrast", checked)}
          />
          <PreferenceRow
            id="reduced-motion"
            label={t("reducedMotion")}
            description={t("reducedMotionDescription")}
            checked={values.reducedMotion}
            disabled={isSaving}
            onCheckedChange={(checked) => handleToggle("reducedMotion", checked)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("voiceLanguageTitle")}</CardTitle>
          <CardDescription>{t("voiceLanguageDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PreferenceRow
            id="voice-responses"
            label={t("voiceResponses")}
            description={t("voiceResponsesDescription")}
            checked={values.voiceResponses}
            disabled={isSaving}
            onCheckedChange={(checked) => handleToggle("voiceResponses", checked)}
          />
          <div className="space-y-2">
            <Label htmlFor="ui-locale" className="text-base">
              {t("language")}
            </Label>
            <Select
              value={values.uiLocale}
              onValueChange={(value) => handleLocale(value as UiLocale)}
              disabled={isSaving}
            >
              <SelectTrigger id="ui-locale" className="min-h-12 w-full text-base sm:max-w-xs">
                <SelectValue placeholder={t("chooseLanguage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EN" className="min-h-12 text-base">
                  {tCommon("english")}
                </SelectItem>
                <SelectItem value="HI" className="min-h-12 text-base">
                  {tCommon("hindi")}
                </SelectItem>
                <SelectItem value="PA" className="min-h-12 text-base">
                  {tCommon("punjabi")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isSaving && (
        <p className="text-sm text-muted-foreground" role="status">
          {tCommon("saving")}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-12"
          disabled={isSaving}
          onClick={() => handleToggle("seniorMode", !values.seniorMode)}
        >
          {values.seniorMode ? t("turnOff") : t("turnOn")}
        </Button>
      </div>
    </div>
  );
}

function PreferenceRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-14 items-start justify-between gap-4 rounded-xl border border-transparent px-1 py-3">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-base">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="mt-1"
      />
    </div>
  );
}
