"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertTriangle,
  ChevronUp,
  Fingerprint,
  MapPin,
  PiggyBank,
  Shield,
  ShoppingBag,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import type { AssistantIntelRailData } from "@/features/assistant/intel-rail";
import { cn } from "@/lib/utils";

function inr(amount: number): string {
  return `₹${Math.round(Math.abs(amount)).toLocaleString("en-IN")}`;
}

export function MobileInsightPeek({
  intel,
  onExpand,
}: {
  intel: AssistantIntelRailData;
  onExpand: () => void;
}) {
  const risk = intel.currentFraudRisk.score ?? 0;
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex w-full items-center gap-3 border-t bg-background/95 px-3 py-2.5 text-left backdrop-blur-md md:hidden"
      aria-label="Open account insights"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
        <PeekStat icon={Wallet} label="Balance" value={inr(intel.balance)} />
        <PeekStat icon={Shield} label="Risk" value={`${risk}/100`} warning={risk >= 60} />
        <PeekStat icon={ShoppingBag} label="Spend" value={inr(intel.monthlySpend)} />
        <PeekStat
          icon={PiggyBank}
          label="Save"
          value={intel.savingsOpportunity?.metricValue ?? "—"}
        />
      </div>
      <ChevronUp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function PeekStat({
  icon: Icon,
  label,
  value,
  warning,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="min-w-[72px] shrink-0">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="size-3" aria-hidden />
        {label}
      </div>
      <p className={cn("truncate text-sm font-semibold tabular-nums", warning && "text-amber-700 dark:text-amber-300")}>
        {value}
      </p>
    </div>
  );
}

export function MobileInsightDrawer({
  open,
  onOpenChange,
  intel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intel: AssistantIntelRailData;
}) {
  const riskScore = intel.currentFraudRisk.score ?? 0;
  const [snap, setSnap] = useState<number | string | null>(0.55);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[0.42, 0.55, 0.92]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <DrawerContent className="md:hidden">
        <DrawerHeader className="text-left">
          <DrawerTitle>Account insights</DrawerTitle>
          <DrawerDescription>
            Drag the handle or swipe to resize. Snap between peek and full view.
          </DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[70dvh] space-y-3 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-2">
            <InsightTile label="Balance" value={inr(intel.balance)} />
            <InsightTile label="Monthly spend" value={inr(intel.monthlySpend)} />
            <InsightTile label="This week" value={inr(intel.weekSpend)} />
            <InsightTile
              label="vs last month"
              value={
                intel.previousMonthSpend > 0
                  ? `${Math.round(
                      ((intel.monthlySpend - intel.previousMonthSpend) / intel.previousMonthSpend) * 100
                    )}%`
                  : "—"
              }
            />
          </div>

          <section className="rounded-xl border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="size-4" aria-hidden />
                Fraud summary
              </p>
              <Badge variant={riskScore >= 60 ? "destructive" : "secondary"}>
                {intel.currentFraudRisk.label}
              </Badge>
            </div>
            <Progress value={riskScore} className="h-2" />
            <p className="mt-2 text-sm text-muted-foreground">Status: {intel.securityStatus}</p>
          </section>

          <section className="rounded-xl border p-3">
            <p className="mb-2 text-sm font-semibold">Top merchants</p>
            <div className="space-y-2">
              {intel.topMerchants.slice(0, 4).map((m) => (
                <div key={m.merchant} className="flex justify-between gap-2 text-sm">
                  <span className="truncate">{m.merchant}</span>
                  <span className="tabular-nums text-muted-foreground">{inr(m.amount)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border p-3">
            <p className="mb-2 text-sm font-semibold">Subscriptions</p>
            {intel.subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">None detected</p>
            ) : (
              <div className="space-y-2">
                {intel.subscriptions.map((s) => (
                  <div key={s.merchant} className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{s.merchant}</span>
                    <span className="tabular-nums">{inr(s.monthlyAmount)}/mo</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Fingerprint className="size-4" aria-hidden />
              Device trust
            </p>
            <div className="space-y-2">
              {intel.devices.slice(0, 3).map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{d.label}</span>
                  <Badge variant={d.trusted ? "secondary" : "outline"}>
                    {d.trusted ? "Trusted" : "Review"}
                  </Badge>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4" aria-hidden />
              Recent login
            </p>
            {intel.recentLogin ? (
              <div className="text-sm">
                <p className="font-medium">{intel.recentLogin.label}</p>
                <p className="text-muted-foreground">
                  {intel.recentLogin.city ?? "Unknown"} ·{" "}
                  {formatDistanceToNow(parseISO(intel.recentLogin.occurredAt), { addSuffix: true })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent login</p>
            )}
          </section>

          <section className="rounded-xl border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4" aria-hidden />
              Open alerts
            </p>
            {intel.openAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <div className="space-y-2">
                {intel.openAlerts.map((a) => (
                  <Link key={a.id} href={`/alerts/${a.id}`} className="block text-sm font-medium underline-offset-4 hover:underline">
                    {a.title}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {intel.savingsOpportunity ? (
            <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <PiggyBank className="size-4 text-emerald-600" aria-hidden />
                Recommendation
              </p>
              <p className="mt-1 text-base font-semibold text-emerald-700 dark:text-emerald-300">
                {intel.savingsOpportunity.metricValue}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{intel.savingsOpportunity.detail}</p>
            </section>
          ) : null}

          <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => onOpenChange(false)}>
            Close insights
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function InsightTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
