"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrainCircuit, ExternalLink, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";

import type { AiRecommendation } from "@/services/admin/get-ai-recommendations";
import { resolveFraudReportAction } from "@/features/admin/investigation-actions";
import { toIncidentId } from "@/lib/incident-id";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

const ACTION_STYLE = {
  BLOCK_ACCOUNT: "border-destructive/40 bg-destructive/10 text-destructive",
  REQUIRE_BIOMETRIC: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  MONITOR_ONLY: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
} as const;

const ACTION_ICON = {
  BLOCK_ACCOUNT: ShieldAlert,
  REQUIRE_BIOMETRIC: ShieldQuestion,
  MONITOR_ONLY: ShieldCheck,
} as const;

export function AiRecommendationCenter({ initial }: { initial: AiRecommendation[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | AiRecommendation["action"]>("ALL");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(
    () => (filter === "ALL" ? initial : initial.filter((row) => row.action === filter)),
    [initial, filter]
  );

  function handleConfirm(reportId: string) {
    setPendingId(reportId);
    startTransition(async () => {
      const result = await resolveFraudReportAction(reportId, "CONFIRMED");
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error ?? "Could not confirm fraud.");
        return;
      }
      toast.success("Fraud confirmed — recommendation will refresh on next load.");
      router.refresh();
    });
  }

  if (initial.length === 0) {
    return (
      <EmptyState
        icon={BrainCircuit}
        title="No recommendations yet"
        description="As customers sign in and FIN correlates fraud signals, AI recommendations will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ALL", "All"],
            ["BLOCK_ACCOUNT", "Block"],
            ["REQUIRE_BIOMETRIC", "Biometric"],
            ["MONITOR_ONLY", "Monitor"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((row) => {
          const Icon = ACTION_ICON[row.action];
          return (
            <Card key={row.userId} className="border-border/60 shadow-none">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{row.customerName}</CardTitle>
                    <CardDescription className="truncate">{row.email}</CardDescription>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0", ACTION_STYLE[row.action])}>
                    <Icon className="size-3.5" />
                    {row.actionLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Risk score</p>
                    <p className="text-lg font-semibold tabular-nums">{row.riskScore}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="text-lg font-semibold tabular-nums">{row.confidence}%</p>
                  </div>
                  {row.latestSessionId && (
                    <div>
                      <p className="text-xs text-muted-foreground">Latest incident</p>
                      <p className="font-mono text-sm font-medium">{toIncidentId(row.latestSessionId)}</p>
                    </div>
                  )}
                  {row.latestCity && (
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="text-sm font-medium">{row.latestCity}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Reasoning</p>
                  <ul className="space-y-1">
                    {row.reasons.map((reason) => (
                      <li key={reason} className="flex gap-2 text-sm text-foreground">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                {row.clusterLabel && (
                  <Badge variant="secondary" className="text-xs">
                    FIN cluster: {row.clusterLabel}
                  </Badge>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/admin/fin/soc">
                      Open SOC <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                  {row.openReportId && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending && pendingId === row.openReportId}
                      onClick={() => handleConfirm(row.openReportId!)}
                    >
                      {isPending && pendingId === row.openReportId ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ShieldAlert className="size-4" />
                      )}
                      Confirm fraud / block
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
