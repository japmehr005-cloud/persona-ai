"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ExternalLink, Inbox } from "lucide-react";

import type { FraudReportView } from "@/services/fin/fraud-report-service";
import { useSocSelectionStore } from "@/stores/soc-selection-store";
import { FRAUD_REPORT_TYPE_LABEL, SEVERITY_BADGE_CLASS } from "@/lib/fin-labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_VARIANT = { OPEN: "outline", CONFIRMED: "destructive", DISMISSED: "secondary" } as const;

export function SocInvestigationQueuePanel({ reports }: { reports: FraudReportView[] }) {
  const selection = useSocSelectionStore((state) => state.selection);
  const select = useSocSelectionStore((state) => state.select);

  return (
    <Card className="flex h-full flex-col gap-2 border-border/50 py-3 shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-3 pb-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Inbox className="size-4 text-muted-foreground" />
            Investigation queue
          </CardTitle>
          <CardDescription className="text-xs">Reports awaiting review</CardDescription>
        </div>
        <Link
          href="/admin/fin/recommendations"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open queue <ExternalLink className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-[320px]">
          <ol className="divide-y divide-border px-4">
            {reports.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">No fraud reports filed yet.</li>
            ) : (
              reports.map((report) => {
                const isSelected = selection?.type === "fraudReport" && selection.id === report.id;
                return (
                  <li key={report.id}>
                    <button
                      type="button"
                      onClick={() =>
                        select({ type: "fraudReport", id: report.id, label: FRAUD_REPORT_TYPE_LABEL[report.type] })
                      }
                      className={cn(
                        "flex w-full items-start justify-between gap-3 py-2.5 text-left transition-colors hover:bg-accent/60",
                        isSelected && "bg-accent"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {FRAUD_REPORT_TYPE_LABEL[report.type]}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {report.reporterName} · {formatDistanceToNowStrict(report.createdAt, { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={STATUS_VARIANT[report.status]} className="text-[10px]">
                          {report.status}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px]", SEVERITY_BADGE_CLASS[report.severity])}>
                          {report.severity}
                        </Badge>
                      </div>
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
