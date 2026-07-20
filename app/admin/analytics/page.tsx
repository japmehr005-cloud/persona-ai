import type { Metadata } from "next";

import { BarChart3 } from "lucide-react";

import { getAdminAnalytics } from "@/services/admin/get-analytics";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import {
  AlertTrendChart,
  CategoryRiskBarChart,
  DispositionDonutChart,
} from "@/components/charts/admin-analytics-charts";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage() {
  const analytics = await getAdminAnalytics();

  return (
    <PageContainer>
      <PageHeader title="Analytics" description="Fraud detection trends and analyst review outcomes." />

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="False positive rate"
          value={analytics.falsePositiveRate !== null ? `${analytics.falsePositiveRate}%` : "—"}
          helperText={
            analytics.reviewedAlertCount > 0
              ? `Based on ${analytics.reviewedAlertCount} reviewed alerts`
              : "No alerts reviewed yet"
          }
        />
        <MetricCard
          label="Alerts reviewed"
          value={analytics.reviewedAlertCount.toString()}
          helperText="Confirmed fraud or false positive"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alert volume</CardTitle>
          <CardDescription>Alerts generated per day over the last 14 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertTrendChart data={analytics.alertTrend} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Analyst dispositions</CardTitle>
            <CardDescription>How reviewed alerts have been classified.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.dispositionBreakdown.every((slice) => slice.count === 0) ? (
              <EmptyState
                icon={BarChart3}
                title="No dispositions yet"
                description="Review alerts from the alert feed to see a breakdown here."
              />
            ) : (
              <DispositionDonutChart data={analytics.dispositionBreakdown} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flagged by category</CardTitle>
            <CardDescription>Merchant categories most often triggering elevated risk.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.categoryBreakdown.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No flagged transactions"
                description="Medium- and high-risk transactions will be broken down by category here."
              />
            ) : (
              <CategoryRiskBarChart data={analytics.categoryBreakdown} />
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
