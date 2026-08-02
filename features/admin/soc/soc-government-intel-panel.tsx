"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Landmark } from "lucide-react";

import type { GovernmentIntelligenceOverview } from "@/services/admin/get-government-intelligence-overview";
import { useSocSelectionStore } from "@/stores/soc-selection-store";
import { GOV_SOURCE_LABEL } from "@/lib/fin-labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RISK_VARIANT = { CLEAR: "outline", LOW: "outline", ELEVATED: "warning", HIGH: "destructive" } as const;

export function SocGovernmentIntelPanel({ overview }: { overview: GovernmentIntelligenceOverview }) {
  const selection = useSocSelectionStore((state) => state.selection);
  const select = useSocSelectionStore((state) => state.select);

  return (
    <Card className="flex h-full flex-col gap-2 border-border/50 py-3 shadow-none">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Landmark className="size-4 text-muted-foreground" />
          Government intelligence
        </CardTitle>
        <CardDescription className="text-xs">
          {overview.friMatched} FRI · {overview.mnrlMatched} MNRL of {overview.totalChecks} checks
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-[220px]">
          <ol className="divide-y divide-border px-4">
            {overview.recentHits.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">No government intelligence hits yet.</li>
            ) : (
              overview.recentHits.map((hit) => {
                const isSelected = selection?.type === "beneficiary" && selection.id === hit.subjectValue.toLowerCase().trim();
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() =>
                        select({
                          type: "beneficiary",
                          id: hit.subjectValue.toLowerCase().trim(),
                          label: hit.subjectValue,
                        })
                      }
                      className={cn(
                        "flex w-full items-start justify-between gap-3 py-2.5 text-left transition-colors hover:bg-accent/60",
                        isSelected && "bg-accent"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{hit.subjectValue}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {GOV_SOURCE_LABEL[hit.source]} · {formatDistanceToNowStrict(hit.checkedAt, { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant={RISK_VARIANT[hit.riskLevel]} className="shrink-0 text-[10px]">
                        {hit.riskLevel}
                      </Badge>
                    </button>
                  </li>
                );
              })
            )}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
