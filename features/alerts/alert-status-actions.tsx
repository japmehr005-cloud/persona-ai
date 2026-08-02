"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { acknowledgeAlertAction, resolveAlertAction } from "@/features/alerts/alert-actions";
import { ActionBar } from "@/features/accessibility/more-actions";
import { Button } from "@/components/ui/button";

export function AlertStatusActions({
  alertId,
  status,
}: {
  alertId: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
}) {
  const t = useTranslations("alerts");
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"acknowledge" | "resolve" | null>(null);

  if (status === "RESOLVED") {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-success" />
        {t("resolved")}
      </span>
    );
  }

  const handleAcknowledge = async () => {
    setPendingAction("acknowledge");
    await acknowledgeAlertAction(alertId);
    setPendingAction(null);
    toast.success(t("acknowledged"));
    router.refresh();
  };

  const handleResolve = async () => {
    setPendingAction("resolve");
    await resolveAlertAction(alertId);
    setPendingAction(null);
    toast.success(t("markedResolved"));
    router.refresh();
  };

  return (
    <ActionBar
      primary={
        <Button onClick={handleResolve} disabled={pendingAction !== null}>
          {pendingAction === "resolve" && <Loader2 className="animate-spin" />}
          {t("markResolved")}
        </Button>
      }
      secondary={
        status === "OPEN" ? (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleAcknowledge}
            disabled={pendingAction !== null}
          >
            {pendingAction === "acknowledge" && <Loader2 className="animate-spin" />}
            {t("acknowledge")}
          </Button>
        ) : undefined
      }
    />
  );
}
