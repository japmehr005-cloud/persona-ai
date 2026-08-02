"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { useAccessibility } from "@/features/accessibility/accessibility-provider";
import { completeA11yOnboardingAction } from "@/features/settings/settings-actions";
import {
  applyA11yDocumentAttrs,
  cascadeSeniorModeOn,
  writeA11yCookie,
  type AccessibilityPreferences,
} from "@/lib/accessibility";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function A11yOnboardingModal() {
  const t = useTranslations("accessibility");
  const tCommon = useTranslations("common");
  const a11y = useAccessibility();
  const [open, setOpen] = useState(!a11y.a11yOnboardingSeen);
  const [isPending, startTransition] = useTransition();

  if (a11y.a11yOnboardingSeen && !open) {
    return null;
  }

  const benefits = [
    t("benefitLargeText"),
    t("benefitContrast"),
    t("benefitVoice"),
    t("benefitSimplified"),
  ] as const;

  const finish = (enable: boolean) => {
    startTransition(async () => {
      const response = await completeA11yOnboardingAction(enable);
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      const next: AccessibilityPreferences = enable
        ? cascadeSeniorModeOn({ ...response.data, a11yOnboardingSeen: true })
        : { ...response.data, a11yOnboardingSeen: true };
      a11y.setPreferences(next, { persist: false });
      applyA11yDocumentAttrs(next);
      writeA11yCookie(next);
      setOpen(false);
      if (enable) {
        toast.success(t("seniorEnabledToast"));
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isPending) {
          finish(false);
        }
      }}
    >
      <DialogContent className="max-w-md gap-6 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="space-y-3 text-left">
          <DialogTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("onboardingTitle")}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-foreground/80 sm:text-lg">
            {t("onboardingDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-lg font-medium text-foreground">{t("onboardingQuestion")}</p>
          <ul className="space-y-3">
            {benefits.map((item) => (
              <li key={item} className="flex items-center gap-3 text-base sm:text-lg">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-4" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground sm:text-base">{t("onboardingHint")}</p>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-stretch">
          <Button
            type="button"
            className="min-h-14 w-full text-base sm:flex-1"
            disabled={isPending}
            onClick={() => finish(true)}
          >
            {tCommon("enable")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-14 w-full text-base sm:flex-1"
            disabled={isPending}
            onClick={() => finish(false)}
          >
            {tCommon("notNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
