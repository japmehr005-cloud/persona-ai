"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import type { AlertSeverity } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Fingerprint, Landmark, Loader2, Network, XCircle } from "lucide-react";
import { toast } from "sonner";

import type { FraudReportView } from "@/services/fin/fraud-report-service";
import type { FraudReportDetail } from "@/services/fin/investigation-service";
import { FRAUD_REPORT_TYPE_LABEL, GOV_SOURCE_LABEL, SEVERITY_BADGE_CLASS } from "@/lib/fin-labels";
import {
  getFraudReportDetailAction,
  resolveFraudReportAction,
  updateFraudReportSeverityAction,
} from "@/features/admin/investigation-actions";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STATUS_VARIANT: Record<FraudReportView["status"], "success" | "warning" | "destructive"> = {
  OPEN: "warning",
  CONFIRMED: "destructive",
  DISMISSED: "success",
};

const SEVERITY_OPTIONS: AlertSeverity[] = ["LOW", "MEDIUM", "HIGH"];

const columns: ColumnDef<FraudReportView>[] = [
  {
    accessorKey: "createdAt",
    header: "Filed",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{format(row.original.createdAt, "MMM d, h:mm a")}</span>
    ),
    sortingFn: "datetime",
  },
  { accessorKey: "reporterName", header: "Reporter" },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => FRAUD_REPORT_TYPE_LABEL[row.original.type],
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => (
      <Badge variant="outline" className={SEVERITY_BADGE_CLASS[row.original.severity]}>
        {row.original.severity}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>,
  },
  {
    accessorKey: "deviceLabel",
    header: "Device",
    cell: ({ row }) => row.original.deviceLabel ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "transactionSummary",
    header: "Linked transaction",
    cell: ({ row }) => row.original.transactionSummary ?? <span className="text-muted-foreground">—</span>,
  },
];

export function InvestigationsTable({ reports }: { reports: FraudReportView[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<FraudReportView | null>(null);
  const [detail, setDetail] = useState<FraudReportDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);
    getFraudReportDetailAction(selected.id).then((result) => {
      if (!cancelled) {
        setDetail(result);
        setIsLoadingDetail(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function handleResolve(status: "CONFIRMED" | "DISMISSED") {
    if (!selected) return;
    setIsPending(true);
    const result = await resolveFraudReportAction(selected.id, status);
    setIsPending(false);

    if (!result.ok) {
      toast.error(result.error ?? "Failed to resolve report.");
      return;
    }

    toast.success(status === "CONFIRMED" ? "Report confirmed as fraud." : "Report marked as false positive.");
    setSelected(null);
    router.refresh();
  }

  async function handleSeverityChange(severity: AlertSeverity) {
    if (!selected) return;
    setIsPending(true);
    const result = await updateFraudReportSeverityAction(selected.id, severity);
    setIsPending(false);

    if (!result.ok) {
      toast.error(result.error ?? "Failed to update severity.");
      return;
    }

    toast.success(`Severity updated to ${severity}.`);
    setSelected((current) => (current ? { ...current, severity } : current));
    router.refresh();
  }

  const isResolved = selected?.status !== "OPEN";

  return (
    <>
      <DataTable
        columns={columns}
        data={reports}
        onRowClick={(row) => setSelected(row)}
        emptyTitle="No fraud reports yet"
        emptyDescription="Customer-filed reports of suspicious logins, transactions, beneficiaries, and devices will appear here for investigation."
        pageSize={20}
      />

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{FRAUD_REPORT_TYPE_LABEL[selected.type]}</SheetTitle>
                <SheetDescription>
                  Filed by {selected.reporterName} · {format(selected.createdAt, "MMM d, yyyy 'at' h:mm a")} (
                  {formatDistanceToNow(selected.createdAt, { addSuffix: true })})
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge variant={STATUS_VARIANT[selected.status]}>{selected.status}</Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Severity</span>
                    <Select
                      value={selected.severity}
                      onValueChange={(value) => handleSeverityChange(value as AlertSeverity)}
                      disabled={isPending}
                    >
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selected.description && (
                  <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
                    {selected.description}
                  </p>
                )}

                {isLoadingDetail && (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                )}

                {detail && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {detail.evidence.device && (
                          <div className="col-span-2 flex items-center gap-2 rounded-lg border border-border p-3">
                            <Fingerprint className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{detail.evidence.device.label}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {detail.evidence.device.trusted ? "Trusted device" : "Not trusted"} · Fingerprint{" "}
                                {detail.evidence.device.fingerprintHash.slice(0, 10)}
                              </p>
                            </div>
                          </div>
                        )}
                        {detail.evidence.session && (
                          <div className="col-span-2 rounded-lg border border-border p-3">
                            <p className="text-xs text-muted-foreground">Session</p>
                            <p className="font-medium text-foreground">
                              {[detail.evidence.session.city, detail.evidence.session.country].filter(Boolean).join(", ") || "Unknown location"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {detail.evidence.session.ipAddress ?? "No IP recorded"} · Risk score{" "}
                              {detail.evidence.session.riskScore ?? "—"}/100
                            </p>
                          </div>
                        )}
                        {detail.evidence.transaction && (
                          <div className="col-span-2 rounded-lg border border-border p-3">
                            <p className="text-xs text-muted-foreground">Transaction</p>
                            <p className="font-medium text-foreground">
                              {detail.evidence.transaction.merchant} · {detail.evidence.transaction.amount}
                            </p>
                          </div>
                        )}
                        {selected.beneficiary && (
                          <div className="col-span-2 rounded-lg border border-border p-3">
                            <p className="text-xs text-muted-foreground">Recipient</p>
                            <p className="font-medium text-foreground">{selected.beneficiary}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {detail.governmentHits.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <Landmark className="size-3.5" /> Government intelligence
                        </p>
                        <ul className="space-y-2">
                          {detail.governmentHits.map((hit, index) => (
                            <li
                              key={index}
                              className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
                            >
                              <span className="text-foreground">{GOV_SOURCE_LABEL[hit.source]}</span>
                              <Badge variant="destructive">{hit.riskLevel}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {detail.clusterMemberships.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <Network className="size-3.5" /> Fraud clusters
                        </p>
                        <ul className="space-y-2">
                          {detail.clusterMemberships.map((cluster) => (
                            <li key={cluster.id} className="rounded-lg border border-border p-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-foreground">{cluster.label}</span>
                                <Badge variant={cluster.riskLevel === "CRITICAL" ? "destructive" : "warning"}>
                                  {cluster.riskLevel}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{cluster.memberCount} linked entities</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {detail.relatedReports.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <AlertTriangle className="size-3.5" /> Related reports ({detail.relatedReports.length})
                        </p>
                        <ul className="space-y-2">
                          {detail.relatedReports.map((related) => (
                            <li key={related.id} className="rounded-lg border border-border p-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-foreground">{FRAUD_REPORT_TYPE_LABEL[related.type]}</span>
                                <Badge variant={STATUS_VARIANT[related.status]}>{related.status}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {related.linkReason} · {related.reporterName} ·{" "}
                                {formatDistanceToNow(related.createdAt, { addSuffix: true })}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              {!isResolved && (
                <div className="flex gap-2 border-t border-border px-6 py-4">
                  <Button
                    variant="outline"
                    className="flex-1 text-success hover:text-success"
                    onClick={() => handleResolve("DISMISSED")}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="animate-spin" /> : <XCircle />}
                    Mark false positive
                  </Button>
                  <Button
                    className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => handleResolve("CONFIRMED")}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                    Confirm fraud
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
