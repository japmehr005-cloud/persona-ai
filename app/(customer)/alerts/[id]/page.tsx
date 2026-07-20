import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getAlertDetail } from "@/services/alerts/get-alert-detail";
import { formatSignedCurrency } from "@/lib/format";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/shared/page-breadcrumbs";
import { RiskBreakdown } from "@/components/shared/risk-breakdown";
import { AlertStatusActions } from "@/features/alerts/alert-status-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Alert detail" };

const SEVERITY_VARIANT = {
  LOW: "outline",
  MEDIUM: "warning",
  HIGH: "destructive",
} as const;

export default async function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const alert = await getAlertDetail(user.id, id);

  if (!alert) notFound();

  return (
    <PageContainer className="max-w-3xl">
      <PageBreadcrumbs items={[{ label: "Alerts", href: "/alerts" }, { label: alert.title }]} />
      <PageHeader
        title={alert.title}
        description={`Raised ${format(alert.createdAt, "MMM d, yyyy 'at' h:mm a")}`}
        actions={<AlertStatusActions alertId={alert.id} status={alert.status} />}
      />

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Explanation</CardTitle>
            <Badge variant={SEVERITY_VARIANT[alert.severity]}>{alert.severity} severity</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{alert.body}</p>
          </CardContent>
        </Card>

        {alert.transaction && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Related transaction</CardTitle>
              <Link
                href={`/transactions/${alert.transaction.id}`}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View transaction
                <ArrowRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Merchant</p>
                <p className="text-sm font-medium text-foreground">{alert.transaction.merchant}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-sm font-medium tabular-nums text-foreground">
                  {formatSignedCurrency(alert.transaction.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="text-sm font-medium text-foreground">{alert.transaction.category}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-medium text-foreground">
                  {format(alert.transaction.date, "MMM d, yyyy")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Risk breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskBreakdown assessment={alert.transaction?.riskAssessment ?? null} />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
