"use client";

import { TrendingDown, TrendingUp, Lightbulb, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinancialInsight } from "@/services/assistant/financial-insights";
import { cn } from "@/lib/utils";

/** Kept for reuse; primary assistant UI now uses IntelRail + response blocks. */
export function InsightCards({ insights }: { insights: FinancialInsight[] }) {
  if (insights.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-base text-muted-foreground">
          Personalized spending insights will appear here once you have enough recent transactions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {insights.slice(0, 4).map((insight) => {
        const Icon =
          insight.severity === "warning"
            ? AlertTriangle
            : insight.severity === "positive"
              ? TrendingDown
              : insight.id.startsWith("cat-up")
                ? TrendingUp
                : Lightbulb;
        return (
          <Card
            key={insight.id}
            className={cn(
              "shadow-sm",
              insight.severity === "warning" && "border-amber-500/40",
              insight.severity === "positive" && "border-emerald-500/40"
            )}
          >
            <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
              <div
                className={cn(
                  "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
                  insight.severity === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  insight.severity === "positive" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  insight.severity === "info" && "bg-muted text-foreground"
                )}
              >
                <Icon className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-semibold leading-snug">{insight.title}</CardTitle>
                {insight.metricValue ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {insight.metricLabel}: {insight.metricValue}
                  </p>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-base leading-relaxed text-muted-foreground">
              {insight.detail}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
