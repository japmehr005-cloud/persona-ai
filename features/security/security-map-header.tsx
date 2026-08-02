"use client";

import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { ReportDialog } from "@/features/fin/report-dialog";
import { Button } from "@/components/ui/button";

export function SecurityMapHeader() {
  const t = useTranslations("security");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("mapTitle")}</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t("mapDescription")}</p>
      </div>
      <ReportDialog
        type="SUSPICIOUS_LOGIN"
        trigger={
          <Button variant="outline" className="text-destructive hover:text-destructive">
            <ShieldAlert />
            {t("reportSuspiciousLogin")}
          </Button>
        }
      />
    </div>
  );
}
