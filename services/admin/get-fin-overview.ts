import { subDays, format } from "date-fns";

import { prisma } from "@/lib/prisma";
import type { AlertSeverity } from "@prisma/client";

export interface FinTrendPoint {
  date: string;
  count: number;
}

export interface FinEventTypeCount {
  type: string;
  count: number;
}

export interface ThreatHeatmapCell {
  day: string;
  severity: AlertSeverity;
  count: number;
}

export interface FinOverviewMetrics {
  openFraudReports: number;
  confirmedFraudReports: number;
  activeClusters: number;
  governmentHits: number;
  finEventTrend: FinTrendPoint[];
  eventTypeBreakdown: FinEventTypeCount[];
  threatHeatmap: ThreatHeatmapCell[];
}

const TREND_WINDOW_DAYS = 14;
const HEATMAP_WINDOW_DAYS = 7;
const TOP_EVENT_TYPE_LIMIT = 8;
const SEVERITIES: AlertSeverity[] = ["HIGH", "MEDIUM", "LOW"];

/**
 * Aggregates the Fraud Intelligence Network's raw event log into the
 * Admin SOC's overview metrics, trend chart, event-type breakdown, and
 * threat heatmap. Deliberately reads straight from `FinEvent`/`FraudReport`/
 * `FraudCluster`/`GovernmentRiskRecord` rather than a separate
 * pre-aggregated table — FIN's event volume is low enough for a hackathon
 * deployment that on-demand aggregation is both simpler and always live.
 */
export async function getFinOverview(): Promise<FinOverviewMetrics> {
  const trendWindowStart = subDays(new Date(), TREND_WINDOW_DAYS - 1);
  const heatmapWindowStart = subDays(new Date(), HEATMAP_WINDOW_DAYS - 1);

  const [
    openFraudReports,
    confirmedFraudReports,
    activeClusters,
    governmentHits,
    recentEvents,
    eventTypeGroups,
  ] = await Promise.all([
    prisma.fraudReport.count({ where: { status: "OPEN" } }),
    prisma.fraudReport.count({ where: { status: "CONFIRMED" } }),
    prisma.fraudCluster.count(),
    prisma.governmentRiskRecord.count({ where: { matched: true } }),
    prisma.finEvent.findMany({
      where: { createdAt: { gte: trendWindowStart } },
      select: { createdAt: true, severity: true },
    }),
    prisma.finEvent.groupBy({ by: ["type"], _count: { _all: true }, orderBy: { _count: { type: "desc" } } }),
  ]);

  const trendBuckets = new Map<string, number>();
  for (let i = 0; i < TREND_WINDOW_DAYS; i++) {
    trendBuckets.set(format(subDays(new Date(), TREND_WINDOW_DAYS - 1 - i), "MMM d"), 0);
  }

  const heatmapBuckets = new Map<string, number>();
  const heatmapDays: string[] = [];
  for (let i = 0; i < HEATMAP_WINDOW_DAYS; i++) {
    const day = format(subDays(new Date(), HEATMAP_WINDOW_DAYS - 1 - i), "MMM d");
    heatmapDays.push(day);
    for (const severity of SEVERITIES) {
      heatmapBuckets.set(`${day}:${severity}`, 0);
    }
  }

  for (const event of recentEvents) {
    const trendKey = format(event.createdAt, "MMM d");
    if (trendBuckets.has(trendKey)) {
      trendBuckets.set(trendKey, (trendBuckets.get(trendKey) ?? 0) + 1);
    }

    if (event.createdAt >= heatmapWindowStart) {
      const heatmapKey = `${trendKey}:${event.severity}`;
      if (heatmapBuckets.has(heatmapKey)) {
        heatmapBuckets.set(heatmapKey, (heatmapBuckets.get(heatmapKey) ?? 0) + 1);
      }
    }
  }

  const threatHeatmap: ThreatHeatmapCell[] = [];
  for (const day of heatmapDays) {
    for (const severity of SEVERITIES) {
      threatHeatmap.push({ day, severity, count: heatmapBuckets.get(`${day}:${severity}`) ?? 0 });
    }
  }

  return {
    openFraudReports,
    confirmedFraudReports,
    activeClusters,
    governmentHits,
    finEventTrend: Array.from(trendBuckets.entries()).map(([date, count]) => ({ date, count })),
    eventTypeBreakdown: eventTypeGroups.slice(0, TOP_EVENT_TYPE_LIMIT).map((group) => ({
      type: group.type.replaceAll("_", " "),
      count: group._count._all,
    })),
    threatHeatmap,
  };
}
