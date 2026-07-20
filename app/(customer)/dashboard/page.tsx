import Link from "next/link";
import type { Metadata } from "next";
import { format } from "date-fns";
import {
  Wallet,
  TrendingDown,
  ShieldCheck,
  Upload,
  Receipt,
  BellRing,
  Activity,
  ArrowRight,
} from "lucide-react";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { getDashboardSummary } from "@/services/dashboard/get-dashboard-summary";
import { getSpendingInsights } from "@/services/dashboard/get-spending-insights";
import { getBehavioralSnapshot } from "@/services/dashboard/get-behavioral-snapshot";
import { SimulatePaymentDialog } from "@/features/transactions/simulate-payment-dialog";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SecurityStatusBadge } from "@/components/shared/security-status-badge";
import { AlertList } from "@/components/shared/alert-list";
import { TransactionsPreviewTable } from "@/components/shared/transactions-preview-table";
import { SpendingAreaChart, CategoryDonutChart } from "@/components/charts/dashboard-charts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  const [summary, insights, behavioral, accounts] = await Promise.all([
    getDashboardSummary(user.id),
    getSpendingInsights(user.id),
    getBehavioralSnapshot(user.id),
    prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, mask: true },
    }),
  ]);

  const spendingDeltaPct =
    summary.previousMonthSpending > 0
      ? ((summary.monthlySpending - summary.previousMonthSpending) / summary.previousMonthSpending) * 100
      : null;

  return (
    <PageContainer>
      <PageHeader
        title={`Good day, ${dbUser?.firstName ?? "there"}`}
        description="Here's your account overview."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/transactions/import">
                <Upload />
                Import statements
              </Link>
            </Button>
            {accounts.length > 0 && <SimulatePaymentDialog accounts={accounts} />}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total balance"
          value={formatCurrency(summary.totalBalance)}
          icon={Wallet}
          helperText={`Account ···· ${summary.primaryAccountMask}`}
        />
        <MetricCard
          label="Monthly spending"
          value={formatCurrency(summary.monthlySpending)}
          icon={TrendingDown}
          delta={
            spendingDeltaPct === null
              ? undefined
              : {
                  value: `${Math.abs(spendingDeltaPct).toFixed(0)}%`,
                  direction: spendingDeltaPct >= 0 ? "up" : "down",
                  tone: spendingDeltaPct >= 0 ? "negative" : "positive",
                }
          }
          helperText="vs last month"
        />
        <Card className="py-6">
          <CardContent className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Security status</p>
              <SecurityStatusBadge status={summary.securityStatus} />
              <p className="text-xs text-muted-foreground">
                {summary.lastVerifiedAt
                  ? `Baseline updated ${format(summary.lastVerifiedAt, "MMM d, yyyy")}`
                  : "Baseline not yet established"}
              </p>
            </div>
            <Link
              href="/security/behavior"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
            >
              <ShieldCheck className="size-4.5" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent transactions</CardTitle>
              <CardDescription>Your five most recent account activities.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/transactions">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {summary.recentTransactions.length === 0 ? (
              <div className="px-6">
                <EmptyState
                  icon={Receipt}
                  title="No transactions yet"
                  description="Import a bank statement to see your activity and let Persona AI start learning your behavior."
                  action={
                    <Button asChild size="sm">
                      <Link href="/transactions/import">Import statements</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <TransactionsPreviewTable transactions={summary.recentTransactions} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Alerts</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/alerts">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {summary.openAlerts.length === 0 ? (
              <EmptyState
                icon={BellRing}
                title="No open alerts"
                description="We'll notify you here if a transaction looks out of character."
              />
            ) : (
              <AlertList alerts={summary.openAlerts} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
            <CardDescription>Last 6 months, excluding income.</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.categoryBreakdown.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Nothing to show yet"
                description="Category insights appear once you have transaction history."
              />
            ) : (
              <CategoryDonutChart data={insights.categoryBreakdown} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly trend</CardTitle>
            <CardDescription>Total spend by month.</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendingAreaChart data={insights.monthlyTrend} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Behavioral snapshot</CardTitle>
            <CardDescription>A quick look at your personal baseline.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/security/behavior">
              View full profile
              <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!behavioral.hasProfile ? (
            <EmptyState
              icon={Activity}
              title="Behavioral profile not yet available"
              description="Import at least 30 transactions or 14 days of history so Persona AI can build your personal baseline."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Typical transaction size</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(behavioral.typicalAmount ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Most active time</p>
                <p className="mt-1 text-lg font-semibold">
                  {behavioral.topActiveHourLabel ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Trusted devices</p>
                <p className="mt-1 text-lg font-semibold">{behavioral.trustedDeviceCount}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
