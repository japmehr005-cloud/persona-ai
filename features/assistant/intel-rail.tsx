"use client";

import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertTriangle,
  Fingerprint,
  MapPin,
  PiggyBank,
  Shield,
  ShoppingBag,
  Wallet,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CategoryDonutChart } from "@/components/charts/dashboard-charts";
import type { FinancialInsight } from "@/services/assistant/financial-insights";
import { cn } from "@/lib/utils";

export interface AssistantIntelRailData {
  balance: number;
  monthlySpend: number;
  previousMonthSpend: number;
  weekSpend: number;
  currentFraudRisk: { score: number | null; tier: string | null; label: string };
  categoryBreakdown: Array<{ category: string; amount: number }>;
  topMerchants: Array<{ merchant: string; amount: number; count: number }>;
  openAlerts: Array<{ id: string; title: string; severity: string; body: string; createdAt: string }>;
  devices: Array<{ label: string; trusted: boolean; lastSeenAt: string }>;
  recentLogin: {
    occurredAt: string;
    label: string;
    city: string | null;
    country: string | null;
    trusted: boolean;
    isSuspicious: boolean;
  } | null;
  subscriptions: Array<{ merchant: string; monthlyAmount: number; occurrences: number }>;
  savingsOpportunity: FinancialInsight | null;
  monthlyTrend: Array<{ month: string; amount: number }>;
  securityStatus: string;
  pinnedInsights: FinancialInsight[];
}

function inr(amount: number): string {
  return `₹${Math.round(Math.abs(amount)).toLocaleString("en-IN")}`;
}

function RailCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-border/70 bg-card/80 shadow-sm backdrop-blur-sm", className)}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4" aria-hidden />
        </div>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export function IntelRail({ intel }: { intel: AssistantIntelRailData }) {
  const mom =
    intel.previousMonthSpend > 0
      ? Math.round(((intel.monthlySpend - intel.previousMonthSpend) / intel.previousMonthSpend) * 100)
      : null;
  const riskScore = intel.currentFraudRisk.score ?? 0;

  return (
    <aside className="flex h-full min-h-0 flex-col border-l bg-gradient-to-b from-background to-muted/30">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-medium text-muted-foreground">Live intelligence</p>
        <p className="text-base font-semibold tracking-tight">Account pulse</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          <RailCard title="Balance" icon={Wallet}>
            <p className="text-2xl font-semibold tracking-tight">{inr(intel.balance)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Across linked accounts</p>
          </RailCard>

          <RailCard title="Monthly spend" icon={TrendingUp}>
            <p className="text-xl font-semibold">{inr(intel.monthlySpend)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Week {inr(intel.weekSpend)}
              {mom !== null ? ` · ${mom > 0 ? "+" : ""}${mom}% vs last month` : ""}
            </p>
          </RailCard>

          <RailCard title="Current fraud risk" icon={Shield}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge
                variant={
                  intel.currentFraudRisk.tier === "HIGH" || intel.currentFraudRisk.tier === "CRITICAL"
                    ? "destructive"
                    : "secondary"
                }
              >
                {intel.currentFraudRisk.label}
              </Badge>
              <span className="text-sm tabular-nums text-muted-foreground">{riskScore}/100</span>
            </div>
            <Progress value={riskScore} className="h-2" />
            <p className="mt-2 text-sm text-muted-foreground">Status: {intel.securityStatus}</p>
          </RailCard>

          {intel.categoryBreakdown.length > 0 ? (
            <RailCard title="Top categories" icon={ShoppingBag}>
              <div className="h-[160px]">
                <CategoryDonutChart data={intel.categoryBreakdown.slice(0, 5)} />
              </div>
            </RailCard>
          ) : null}

          <RailCard title="Top merchants" icon={ShoppingBag}>
            <div className="space-y-2">
              {intel.topMerchants.slice(0, 4).map((m) => (
                <div key={m.merchant} className="flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{m.merchant}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{inr(m.amount)}</span>
                </div>
              ))}
              {intel.topMerchants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No merchant activity yet.</p>
              ) : null}
            </div>
          </RailCard>

          <RailCard title="Open alerts" icon={AlertTriangle}>
            <div className="space-y-2">
              {intel.openAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open alerts.</p>
              ) : (
                intel.openAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={`/alerts/${alert.id}`}
                    className="block rounded-lg border px-2.5 py-2 transition hover:bg-muted/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{alert.title}</p>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {alert.severity}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </RailCard>

          <RailCard title="Device trust" icon={Fingerprint}>
            <div className="space-y-2">
              {intel.devices.slice(0, 3).map((device) => (
                <div key={device.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{device.label}</span>
                  <Badge variant={device.trusted ? "secondary" : "outline"}>
                    {device.trusted ? "Trusted" : "Review"}
                  </Badge>
                </div>
              ))}
            </div>
          </RailCard>

          <RailCard title="Recent login" icon={MapPin}>
            {intel.recentLogin ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{intel.recentLogin.label}</p>
                <p className="text-muted-foreground">
                  {intel.recentLogin.city ?? "Unknown city"}
                  {intel.recentLogin.country ? `, ${intel.recentLogin.country}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {formatDistanceToNow(parseISO(intel.recentLogin.occurredAt), { addSuffix: true })}
                </p>
                {intel.recentLogin.isSuspicious ? (
                  <Badge variant="destructive">Suspicious</Badge>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent login in context.</p>
            )}
          </RailCard>

          <RailCard title="Subscriptions" icon={ShoppingBag}>
            {intel.subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recurring payments detected.</p>
            ) : (
              <div className="space-y-2">
                {intel.subscriptions.map((sub) => (
                  <div key={sub.merchant} className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{sub.merchant}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {inr(sub.monthlyAmount)}/mo
                    </span>
                  </div>
                ))}
              </div>
            )}
          </RailCard>

          {intel.savingsOpportunity ? (
            <RailCard title="Savings opportunity" icon={PiggyBank} className="border-emerald-500/30">
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {intel.savingsOpportunity.metricValue ?? "Opportunity"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{intel.savingsOpportunity.detail}</p>
            </RailCard>
          ) : null}

          <RailCard title="Monthly comparison" icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-2">
                <p className="text-muted-foreground">This month</p>
                <p className="font-semibold tabular-nums">{inr(intel.monthlySpend)}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-muted-foreground">Last month</p>
                <p className="font-semibold tabular-nums">{inr(intel.previousMonthSpend)}</p>
              </div>
            </div>
          </RailCard>
        </div>
      </ScrollArea>
    </aside>
  );
}
