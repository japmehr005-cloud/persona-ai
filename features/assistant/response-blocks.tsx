"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  PiggyBank,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CategoryDonutChart } from "@/components/charts/dashboard-charts";
import { SpendingAreaChart } from "@/components/charts/dashboard-charts";
import type { AssistantBlock } from "@/services/assistant/blocks";
import { cn } from "@/lib/utils";

function tierBadge(tier: string | null) {
  if (!tier) return "secondary";
  if (tier === "CRITICAL" || tier === "HIGH") return "destructive";
  if (tier === "MEDIUM") return "secondary";
  return "outline";
}

export function ResponseBlocks({
  blocks,
  onPrompt,
}: {
  blocks: AssistantBlock[];
  onPrompt: (prompt: string) => void;
}) {
  if (blocks.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        switch (block.type) {
          case "risk-summary":
            return (
              <Card key={key} className="overflow-hidden border-border/80 bg-gradient-to-br from-card to-muted/30 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldAlert className="size-4 text-amber-600" aria-hidden />
                      {block.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {block.tier ? (
                        <Badge variant={tierBadge(block.tier) as "destructive" | "secondary" | "outline"}>
                          {block.tier}
                        </Badge>
                      ) : null}
                      {block.score !== null ? (
                        <Badge variant="outline">{block.score}/100</Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {block.score !== null ? (
                    <div>
                      <div className="mb-1 flex justify-between text-sm text-muted-foreground">
                        <span>Risk meter</span>
                        <span>{block.score}/100</span>
                      </div>
                      <Progress value={block.score} className="h-2.5" />
                    </div>
                  ) : null}
                  <div>
                    <p className="mb-2 text-sm font-medium">Reasons</p>
                    <ul className="space-y-1.5 text-base text-muted-foreground">
                      {block.reasons.map((reason) => (
                        <li key={reason} className="flex gap-2">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-3">
                    <p className="text-sm font-medium">Recommendation</p>
                    <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                      {block.recommendation}
                    </p>
                  </div>
                  {block.explanation ? (
                    <p className="text-sm text-muted-foreground">{block.explanation}</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          case "stat-grid":
            return (
              <Card key={key} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{block.title}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {block.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className={cn(
                        "rounded-xl border p-3",
                        stat.tone === "warning" && "border-amber-500/30 bg-amber-500/5",
                        stat.tone === "positive" && "border-emerald-500/30 bg-emerald-500/5",
                        stat.tone === "critical" && "border-destructive/30 bg-destructive/5"
                      )}
                    >
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 text-lg font-semibold tracking-tight">{stat.value}</p>
                      {stat.hint ? (
                        <p className="mt-1 text-sm text-muted-foreground">{stat.hint}</p>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          case "transaction-table":
            return (
              <Card key={key} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{block.title}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-base">
                    <thead className="text-sm text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-3 font-medium">Merchant</th>
                        <th className="py-2 pr-3 font-medium">Amount</th>
                        <th className="py-2 pr-3 font-medium">Category</th>
                        <th className="py-2 pr-3 font-medium">Date</th>
                        <th className="py-2 font-medium">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row) => (
                        <tr key={`${row.merchant}-${row.date}-${row.amount}`} className="border-b last:border-0">
                          <td className="py-2.5 pr-3">
                            {row.id ? (
                              <Link href={`/transactions/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                                {row.merchant}
                              </Link>
                            ) : (
                              row.merchant
                            )}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums">{row.amount}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{row.category}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{row.date}</td>
                          <td className="py-2.5">
                            {row.riskTier ? (
                              <Badge variant={tierBadge(row.riskTier) as "destructive" | "secondary" | "outline"}>
                                {row.riskTier}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          case "category-chart":
            return (
              <Card key={key} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{block.title}</CardTitle>
                </CardHeader>
                <CardContent className="h-[220px]">
                  <CategoryDonutChart data={block.data} />
                </CardContent>
              </Card>
            );
          case "trend-chart":
            return (
              <Card key={key} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{block.title}</CardTitle>
                </CardHeader>
                <CardContent className="h-[220px]">
                  <SpendingAreaChart data={block.data} />
                </CardContent>
              </Card>
            );
          case "merchant-list":
            return (
              <Card key={key} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{block.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {block.merchants.map((m) => (
                    <div
                      key={m.merchant}
                      className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
                    >
                      <div>
                        <p className="font-medium">{m.merchant}</p>
                        {m.count !== undefined ? (
                          <p className="text-sm text-muted-foreground">{m.count} visits</p>
                        ) : null}
                      </div>
                      <p className="tabular-nums font-semibold">{m.amount}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          case "timeline":
            return (
              <Card key={key} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{block.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {block.events.map((event, i) => (
                    <div key={`${event.label}-${i}`} className="flex gap-3">
                      <div
                        className={cn(
                          "mt-1.5 size-2.5 shrink-0 rounded-full",
                          event.tone === "warning" && "bg-amber-500",
                          event.tone === "critical" && "bg-destructive",
                          event.tone === "positive" && "bg-emerald-500",
                          (!event.tone || event.tone === "neutral") && "bg-muted-foreground/50"
                        )}
                      />
                      <div>
                        <p className="font-medium">{event.label}</p>
                        <p className="text-sm text-muted-foreground">{event.detail}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          case "action-row":
            return (
              <div key={key} className="flex flex-wrap gap-2">
                {block.actions.map((action) =>
                  action.href ? (
                    <Button key={action.label} asChild variant={action.variant ?? "outline"} className="min-h-11">
                      <Link href={action.href}>
                        {action.label}
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      key={action.label}
                      type="button"
                      variant={action.variant ?? "secondary"}
                      className="min-h-11"
                      onClick={() => action.prompt && onPrompt(action.prompt)}
                    >
                      {action.label}
                    </Button>
                  )
                )}
              </div>
            );
          case "alert-callout":
            return (
              <Card
                key={key}
                className={cn(
                  "shadow-sm",
                  block.severity === "warning" && "border-amber-500/40 bg-amber-500/5",
                  block.severity === "critical" && "border-destructive/40 bg-destructive/5"
                )}
              >
                <CardContent className="flex gap-3 pt-5">
                  {block.severity === "info" ? (
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
                  )}
                  <div>
                    <p className="font-semibold">{block.title}</p>
                    <p className="mt-1 text-base text-muted-foreground">{block.body}</p>
                  </div>
                </CardContent>
              </Card>
            );
          case "savings-card":
            return (
              <Card key={key} className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PiggyBank className="size-4 text-emerald-600" aria-hidden />
                    {block.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
                    {block.amount}
                  </p>
                  <p className="mt-2 text-base text-muted-foreground">{block.detail}</p>
                  <ul className="mt-3 space-y-1.5 text-base text-muted-foreground">
                    {block.tips.map((tip) => (
                      <li key={tip}>• {tip}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
