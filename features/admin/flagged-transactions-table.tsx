"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Loader2, Phone, MapPin, MessageSquare, ShieldOff, XCircle } from "lucide-react";
import { toast } from "sonner";

import { formatSignedCurrency } from "@/lib/format";
import type { FlaggedQueueRow } from "@/services/admin/get-flagged-queue";
import {
  approveFlaggedTransactionAction,
  denyFlaggedTransactionAction,
} from "@/features/admin/flagged-transaction-actions";
import { DataTable } from "@/components/tables/data-table";
import { RiskBadge, type RiskTier } from "@/components/shared/risk-badge";
import { RiskBreakdown } from "@/components/shared/risk-breakdown";
import { AuditTrail } from "@/components/shared/audit-trail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const STATUS_VARIANT: Record<FlaggedQueueRow["status"], "success" | "warning" | "destructive"> = {
  APPROVED: "success",
  PENDING: "warning",
  PAUSED_FOR_VERIFICATION: "warning",
  FLAGGED: "warning",
  DENIED: "destructive",
};

const SIGNAL_ICONS = { CALL: Phone, SMS: MessageSquare, LOCATION: MapPin, DEVICE: ShieldOff } as const;

const columns: ColumnDef<FlaggedQueueRow>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{format(row.original.date, "MMM d, h:mm a")}</span>
    ),
    sortingFn: "datetime",
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">{row.original.customerName}</p>
        <p className="text-xs text-muted-foreground">{row.original.customerEmail}</p>
      </div>
    ),
  },
  { accessorKey: "merchant", header: "Merchant" },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => <span className="tabular-nums">{formatSignedCurrency(row.original.amount)}</span>,
  },
  {
    accessorKey: "score",
    header: "Score",
    cell: ({ row }) => <span className="tabular-nums">{row.original.score}</span>,
  },
  {
    accessorKey: "tier",
    header: "Risk",
    cell: ({ row }) => <RiskBadge tier={row.original.tier as RiskTier} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>
    ),
  },
];

export function FlaggedTransactionsTable({ transactions }: { transactions: FlaggedQueueRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<FlaggedQueueRow | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [confirmDeny, setConfirmDeny] = useState(false);

  const handleApprove = async () => {
    if (!selected) return;
    setIsPending(true);
    await approveFlaggedTransactionAction(selected.id);
    setIsPending(false);
    toast.success("Transaction approved.");
    setSelected(null);
    router.refresh();
  };

  const handleDeny = async () => {
    if (!selected) return;
    setIsPending(true);
    await denyFlaggedTransactionAction(selected.id);
    setIsPending(false);
    toast.success("Transaction denied.");
    setConfirmDeny(false);
    setSelected(null);
    router.refresh();
  };

  const isResolved = selected?.alertStatus === "RESOLVED";

  return (
    <>
      <DataTable
        columns={columns}
        data={transactions}
        onRowClick={(row) => setSelected(row)}
        emptyTitle="No flagged transactions"
        emptyDescription="Medium- and high-risk transactions across all customers will appear here."
        pageSize={20}
      />

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.merchant}</SheetTitle>
                <SheetDescription>
                  {selected.customerName} · {format(selected.date, "MMM d, yyyy 'at' h:mm a")}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-6">
                <div className="flex items-center justify-end">
                  <Badge variant={STATUS_VARIANT[selected.status]}>{selected.status}</Badge>
                </div>

                <RiskBreakdown
                  assessment={{
                    score: selected.score,
                    tier: selected.tier,
                    explanation: selected.explanation,
                    recommendation: selected.recommendation,
                    otpRequired: selected.otpChallenge !== null,
                    factors: selected.factors,
                  }}
                />

                {selected.contextSignals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Context signals</p>
                    <ul className="space-y-1.5">
                      {selected.contextSignals.map((signal, index) => {
                        const Icon = SIGNAL_ICONS[signal.type];
                        return (
                          <li key={index} className="flex items-center gap-2 text-sm text-foreground">
                            <Icon className="size-3.5 text-muted-foreground" />
                            {signal.label}
                            <span className="text-xs text-muted-foreground">
                              ({format(signal.receivedAt, "h:mm a")})
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {selected.otpChallenge && (
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">CB-OTP challenge</p>
                    <p className="mt-1 text-foreground">
                      {selected.otpChallenge.status} · {selected.otpChallenge.attempts}/
                      {selected.otpChallenge.maxAttempts} attempts
                    </p>
                  </div>
                )}

                {selected.auditTrail.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Activity</p>
                    <AuditTrail entries={selected.auditTrail} />
                  </div>
                )}
              </div>

              {!isResolved && (
                <SheetFooter className="flex-row">
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => setConfirmDeny(true)}
                    disabled={isPending}
                  >
                    <XCircle />
                    Deny
                  </Button>
                  <Button className="flex-1" onClick={handleApprove} disabled={isPending}>
                    {isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                    Approve
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDeny} onOpenChange={setConfirmDeny}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              The customer will see this transaction as denied and any pending step-up
              verification will be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={(event) => { event.preventDefault(); handleDeny(); }}>
              {isPending && <Loader2 className="animate-spin" />}
              Deny transaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
