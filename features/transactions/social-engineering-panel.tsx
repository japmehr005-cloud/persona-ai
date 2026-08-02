"use client";

import { PhoneCall, ShieldAlert, ShieldCheck } from "lucide-react";

import type { SocialEngineeringEvaluation } from "@/services/social-engineering";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SocialEngineeringPanel({
  evaluation,
  className,
}: {
  evaluation: SocialEngineeringEvaluation;
  className?: string;
}) {
  const triggered = evaluation.triggered && evaluation.activeSignals.length > 0;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border p-4",
        triggered
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border bg-muted/30",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {triggered ? (
            <ShieldAlert className="size-5 text-amber-700 dark:text-amber-400" aria-hidden />
          ) : (
            <ShieldCheck className="size-5 text-muted-foreground" aria-hidden />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">Social Engineering Check</p>
            <p className="text-xs text-muted-foreground">
              Independent of the Risk Engine — never changes the risk score
            </p>
          </div>
        </div>
        <Badge variant={triggered ? "outline" : "secondary"}>
          {triggered ? "Signal detected" : "Clear"}
        </Badge>
      </div>

      {triggered ? (
        <ul className="space-y-2">
          {evaluation.activeSignals.map((signal) => (
            <li
              key={signal.id}
              className="flex gap-3 rounded-lg border border-amber-500/30 bg-background/80 px-3 py-2.5"
            >
              <PhoneCall className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-foreground">{signal.label}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{signal.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No social engineering signals detected.</p>
      )}
    </div>
  );
}

export function OrchestratorDecisionBadge({
  decision,
}: {
  decision: "APPROVED" | "BLOCKED" | "PAUSED_FOR_VERIFICATION" | "PENDING";
}) {
  const config = {
    APPROVED: {
      label: "Transaction Approved",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    },
    BLOCKED: {
      label: "Transaction Blocked",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    },
    PAUSED_FOR_VERIFICATION: {
      label: "Transaction Paused",
      className: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300",
    },
    PENDING: {
      label: "Verification Required",
      className: "border-orange-500/40 bg-orange-500/10 text-orange-900 dark:text-orange-300",
    },
  }[decision];

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-semibold",
        config.className
      )}
    >
      Status · {config.label}
    </div>
  );
}
