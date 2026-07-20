"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatSignedCurrency } from "@/lib/format";
import type { AlertRow as AlertRowData } from "@/services/alerts/get-user-alerts";
import { Badge } from "@/components/ui/badge";
import { RiskBreakdownDialog } from "@/components/shared/risk-breakdown-dialog";

const SEVERITY_STYLES: Record<AlertRowData["severity"], string> = {
  LOW: "text-muted-foreground bg-muted",
  MEDIUM: "text-warning bg-warning/10",
  HIGH: "text-destructive bg-destructive/10",
};

const STATUS_VARIANT: Record<AlertRowData["status"], "warning" | "outline" | "success"> = {
  OPEN: "warning",
  ACKNOWLEDGED: "outline",
  RESOLVED: "success",
};

export function AlertRow({ alert }: { alert: AlertRowData }) {
  return (
    <div className="flex items-start gap-3 p-4">
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
        </div>
        <p className="text-sm text-muted-foreground">{alert.body}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{formatDistanceToNow(alert.createdAt, { addSuffix: true })}</span>
          {alert.transactionMerchant && (
            <span>
              {alert.transactionMerchant} · {formatSignedCurrency(alert.transactionAmount ?? 0)}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {alert.transactionId && alert.riskTier && (
          <RiskBreakdownDialog
            assessment={{
              score: alert.riskScore ?? 0,
              tier: alert.riskTier,
              explanation: alert.riskExplanation ?? alert.body,
              otpRequired: alert.otpRequired,
              factors: alert.factors,
            }}
          />
        )}
        <Link
          href={`/alerts/${alert.id}`}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="View alert detail"
        >
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
