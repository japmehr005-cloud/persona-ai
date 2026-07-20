import Link from "next/link";
import type { Metadata } from "next";
import { format } from "date-fns";
import { Activity, Upload } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getBehavioralProfileView } from "@/services/behavior-engine/get-behavioral-profile-view";
import { formatCurrency } from "@/lib/format";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";
import { ActivityHourChart, MerchantBarChart } from "@/components/charts/behavior-charts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Behavioral profile" };

export default async function BehavioralProfilePage() {
  const user = await requireUser();
  const profile = await getBehavioralProfileView(user.id);

  if (!profile.hasProfile) {
    const { transactionCount, minRequired } = profile.progressTowardBaseline;
    const progressPct = Math.min(100, Math.round((transactionCount / minRequired) * 100));

    return (
      <PageContainer className="max-w-3xl">
        <PageHeader
          title="Behavioral profile"
          description="Your personal baseline for spending, timing and merchant patterns."
        />
        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={Activity}
              title="Building your behavioral profile"
              description="Persona AI needs at least 30 transactions or 14 days of history to build a statistically meaningful baseline."
              action={
                <Button asChild size="sm">
                  <Link href="/transactions/import">
                    <Upload />
                    Import statements
                  </Link>
                </Button>
              }
            />
            <div className="mx-auto mt-6 max-w-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress toward baseline</span>
                <span>
                  {transactionCount} / {minRequired} transactions
                </span>
              </div>
              <Progress value={progressPct} />
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const activeHours = profile.activeHours.map((frequency, hour) => ({
    hourLabel: hour % 3 === 0 ? formatHourLabel(hour) : "",
    frequency,
  }));

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        title="Behavioral profile"
        description={`Baseline v${profile.version} · updated ${
          profile.updatedAt ? format(profile.updatedAt, "MMM d, yyyy") : "recently"
        } · built from ${profile.sampleSize} transactions`}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Typical amount" value={formatCurrency(profile.avgAmount)} />
        <MetricCard label="Median amount" value={formatCurrency(profile.medianAmount)} />
        <MetricCard label="95th percentile" value={formatCurrency(profile.p95Amount)} />
        <MetricCard label="Transactions / day" value={profile.txPerDay.toFixed(1)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active hours</CardTitle>
            <CardDescription>When you typically transact, by hour of day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityHourChart data={activeHours} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top merchants</CardTitle>
            <CardDescription>Where most of your spending goes.</CardDescription>
          </CardHeader>
          <CardContent>
            {profile.topMerchants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough merchant variety yet.</p>
            ) : (
              <MerchantBarChart
                data={profile.topMerchants.map((m) => ({
                  merchant: m.merchant,
                  totalAmount: m.totalAmount,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function formatHourLabel(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}
