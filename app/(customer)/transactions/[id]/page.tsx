import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import { ShieldAlert } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getTransactionDetail } from "@/services/transactions/get-transaction-detail";
import { getAuditTrailForEntities } from "@/services/audit/get-audit-trail";
import { formatSignedCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/shared/page-breadcrumbs";
import { RiskBreakdown } from "@/components/shared/risk-breakdown";
import { AuditTrail } from "@/components/shared/audit-trail";
import { ReportDialog } from "@/features/fin/report-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Transaction detail" };

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  APPROVED: "success",
  PENDING: "warning",
  FLAGGED: "warning",
  DENIED: "destructive",
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const transaction = await getTransactionDetail(user.id, id);

  if (!transaction) notFound();

  const auditTrail = await getAuditTrailForEntities([transaction.id]);

  return (
    <PageContainer className="max-w-4xl">
      <PageBreadcrumbs
        items={[
          { label: "Transactions", href: "/transactions" },
          { label: transaction.merchant },
        ]}
      />
      <PageHeader
        title={transaction.merchant}
        description={`${transaction.category} · ${transaction.accountName} ···· ${transaction.accountMask}`}
      />

      {transaction.pendingOtpChallengeId && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
              <ShieldAlert className="size-4.5" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Additional verification required</p>
              <p className="text-sm text-muted-foreground">
                Complete step-up verification to finish authorizing this transaction.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/verify/otp?challengeId=${transaction.pendingOtpChallengeId}`}>Verify now</Link>
          </Button>
        </div>
      )}

      {transaction.pendingVerificationSession && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <ShieldAlert className="size-4.5" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">High-risk transaction detected</p>
              <p className="text-sm text-muted-foreground">
                This transaction is on hold. Verify your identity to continue, or cancel it.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/verify/session/${transaction.id}`}>Review now</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  transaction.amount < 0 ? "text-foreground" : "text-success"
                )}
              >
                {formatSignedCurrency(transaction.amount)}
              </p>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Date" value={format(transaction.date, "MMM d, yyyy")} />
              <Row
                label="Status"
                value={<Badge variant={STATUS_VARIANT[transaction.status]}>{transaction.status}</Badge>}
              />
              <Row label="Channel" value={transaction.channel} />
              {transaction.beneficiary && <Row label="Beneficiary" value={transaction.beneficiary} />}
              {transaction.isSimulated && <Row label="Source" value="Simulated payment" />}
              {transaction.importedFromFilename && (
                <Row label="Imported from" value={transaction.importedFromFilename} />
              )}
            </dl>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <ReportDialog
                type="SUSPICIOUS_TRANSACTION"
                transactionId={transaction.id}
                trigger={
                  <Button variant="outline" className="w-full justify-center text-destructive hover:text-destructive">
                    <ShieldAlert />
                    Report suspicious transaction
                  </Button>
                }
              />
              {transaction.beneficiary && (
                <ReportDialog
                  type="SUSPICIOUS_BENEFICIARY"
                  transactionId={transaction.id}
                  beneficiary={transaction.beneficiary}
                  trigger={
                    <Button variant="outline" className="w-full justify-center text-destructive hover:text-destructive">
                      <ShieldAlert />
                      Report suspicious beneficiary
                    </Button>
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Risk assessment</CardTitle>
            <CardDescription>
              How the Adaptive Behavioral Risk Engine evaluated this transaction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RiskBreakdown
              assessment={
                transaction.riskAssessment && {
                  ...transaction.riskAssessment,
                  actualAmount: transaction.riskAssessment.actualAmount,
                  baseline: transaction.riskAssessment.baseline,
                }
              }
            />
          </CardContent>
        </Card>
      </div>

      {auditTrail.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Security events recorded for this transaction.</CardDescription>
          </CardHeader>
          <CardContent>
            <AuditTrail entries={auditTrail} />
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
