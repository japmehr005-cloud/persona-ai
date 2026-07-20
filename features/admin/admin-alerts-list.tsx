"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, MoreHorizontal, ShieldAlert, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatSignedCurrency } from "@/lib/format";
import type { SystemAlertRow } from "@/services/admin/get-system-alerts";
import { setAlertDispositionAction } from "@/features/admin/alert-disposition-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SEVERITY_STYLES: Record<SystemAlertRow["severity"], string> = {
  LOW: "text-muted-foreground bg-muted",
  MEDIUM: "text-warning bg-warning/10",
  HIGH: "text-destructive bg-destructive/10",
};

const STATUS_VARIANT: Record<SystemAlertRow["status"], "warning" | "outline" | "success"> = {
  OPEN: "warning",
  ACKNOWLEDGED: "outline",
  RESOLVED: "success",
};

const DISPOSITION_LABELS: Record<SystemAlertRow["disposition"], string> = {
  UNREVIEWED: "Unreviewed",
  CONFIRMED_FRAUD: "Confirmed fraud",
  FALSE_POSITIVE: "False positive",
  ESCALATED: "Escalated",
};

type Disposition = "CONFIRMED_FRAUD" | "FALSE_POSITIVE" | "ESCALATED";

export function AdminAlertsList({ alerts }: { alerts: SystemAlertRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleSetDisposition = async (alertId: string, disposition: Disposition) => {
    setPendingId(alertId);
    const result = await setAlertDispositionAction({ alertId, disposition });
    setPendingId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Marked as ${DISPOSITION_LABELS[disposition].toLowerCase()}.`);
    router.refresh();
  };

  return (
    <ul className="divide-y divide-border">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex items-start gap-3 p-4">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              SEVERITY_STYLES[alert.severity]
            )}
          >
            <AlertTriangle className="size-4" />
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{alert.title}</p>
              <Badge variant={STATUS_VARIANT[alert.status]}>{alert.status}</Badge>
              {alert.disposition !== "UNREVIEWED" && (
                <Badge variant="outline">{DISPOSITION_LABELS[alert.disposition]}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{alert.body}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{alert.customerName}</span>
              <span>{formatDistanceToNow(alert.createdAt, { addSuffix: true })}</span>
              {alert.transactionMerchant && (
                <span>
                  {alert.transactionMerchant} · {formatSignedCurrency(alert.transactionAmount ?? 0)}
                </span>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={pendingId === alert.id} aria-label="Alert actions">
                {pendingId === alert.id ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSetDisposition(alert.id, "CONFIRMED_FRAUD")}>
                <ShieldX className="text-destructive" />
                Confirm fraud
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetDisposition(alert.id, "FALSE_POSITIVE")}>
                <CheckCircle2 className="text-success" />
                Mark false positive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetDisposition(alert.id, "ESCALATED")}>
                <ShieldAlert className="text-warning" />
                Escalate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ))}
    </ul>
  );
}
