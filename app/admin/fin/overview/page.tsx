import type { Metadata } from "next";
import { AlertTriangle, Flag, Landmark, Network } from "lucide-react";

import { getFinOverview } from "@/services/admin/get-fin-overview";
import { getRecentFinEvents } from "@/services/fin/fin-event-logger";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ThreatHeatmap } from "@/components/shared/threat-heatmap";
import { FinEventTrendChart, FinEventTypeBarChart } from "@/components/charts/admin-fin-charts";
import { FinLiveEventStream } from "@/features/admin/fin-live-event-stream";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "FIN analytics" };

export default async function FinOverviewPage() {
  const [overview, liveEvents] = await Promise.all([
    getFinOverview(),
    getRecentFinEvents({ limit: 15 }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="FIN Analytics"
        description="Trend analysis and historical breakdowns for the Fraud Intelligence Network. For the live command center, see Security Operations Center."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open fraud reports" value={overview.openFraudReports.toString()} icon={Flag} />
        <MetricCard
          label="Confirmed fraud"
          value={overview.confirmedFraudReports.toString()}
          icon={AlertTriangle}
        />
        <MetricCard label="Active clusters" value={overview.activeClusters.toString()} icon={Network} />
        <MetricCard label="Government intel hits" value={overview.governmentHits.toString()} icon={Landmark} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>FIN event volume</CardTitle>
            <CardDescription>Fraud Intelligence Network events generated per day, last 14 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.finEventTrend.every((point) => point.count === 0) ? (
              <EmptyState
                icon={AlertTriangle}
                title="No FIN events yet"
                description="Events appear as customers sign in, transact, and report suspicious activity."
              />
            ) : (
              <FinEventTrendChart data={overview.finEventTrend} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Live security events</CardTitle>
            <CardDescription>Streaming in near real time as FIN correlates new signal.</CardDescription>
          </CardHeader>
          <CardContent>
            <FinLiveEventStream initialEvents={liveEvents} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Threat heatmap</CardTitle>
            <CardDescription>FIN event severity by day, last 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.threatHeatmap.every((cell) => cell.count === 0) ? (
              <EmptyState
                icon={AlertTriangle}
                title="No activity in this window"
                description="Severity trends will appear here once FIN records events."
              />
            ) : (
              <ThreatHeatmap data={overview.threatHeatmap} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Event types</CardTitle>
            <CardDescription>Most common Fraud Intelligence Network event types.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.eventTypeBreakdown.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No events yet"
                description="A breakdown by event type will appear here."
              />
            ) : (
              <FinEventTypeBarChart data={overview.eventTypeBreakdown} />
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
