import Link from "next/link";
import type { Metadata } from "next";
import { Users, FlagTriangleRight, BellRing, Gauge, ArrowRight } from "lucide-react";

import { getAdminOverview } from "@/services/admin/get-overview";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { AdminAlertFeed } from "@/features/admin/admin-alert-feed";
import { FlaggedPreviewTable } from "@/features/admin/flagged-preview-table";
import { RiskDistributionBar } from "@/components/charts/admin-overview-charts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();

  return (
    <PageContainer>
      <PageHeader
        title="Operations overview"
        description="System-wide fraud signal and customer risk posture."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total customers" value={overview.totalUsers.toString()} icon={Users} />
        <MetricCard
          label="Flagged (24h)"
          value={overview.flaggedLast24h.toString()}
          icon={FlagTriangleRight}
        />
        <MetricCard label="Open alerts" value={overview.openAlerts.toString()} icon={BellRing} />
        <MetricCard
          label="Avg risk score"
          value={overview.avgRiskScore.toString()}
          icon={Gauge}
          helperText="system-wide"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Risk distribution</CardTitle>
            <CardDescription>Assessed transactions by tier, all customers.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.riskDistribution.every((point) => point.count === 0) ? (
              <EmptyState
                icon={Gauge}
                title="No assessments yet"
                description="Risk distribution appears once transactions have been scored."
              />
            ) : (
              <RiskDistributionBar data={overview.riskDistribution} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent alerts</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/alerts">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {overview.recentAlerts.length === 0 ? (
              <EmptyState
                icon={BellRing}
                title="No alerts yet"
                description="Alerts raised across all customers will appear here."
              />
            ) : (
              <AdminAlertFeed alerts={overview.recentAlerts} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Flagged transactions</CardTitle>
            <CardDescription>Most recent medium- and high-risk transactions.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/transactions/flagged">
              View queue
              <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {overview.topFlaggedTransactions.length === 0 ? (
            <div className="px-6">
              <EmptyState
                icon={FlagTriangleRight}
                title="No flagged transactions"
                description="Medium- and high-risk transactions across all customers will appear here."
              />
            </div>
          ) : (
            <FlaggedPreviewTable transactions={overview.topFlaggedTransactions} />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
