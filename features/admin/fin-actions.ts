"use server";

import { revalidatePath } from "next/cache";

import { requireAnalyst } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRecentFinEvents, type FinEventView } from "@/services/fin/fin-event-logger";
import { recomputeClusters } from "@/services/fin/cluster-engine";
import { logAuditEvent } from "@/services/audit/audit-logger";
import { getThreatMapData, type ThreatMapData } from "@/services/fin/geo-intelligence";
import {
  getRelationshipGraph,
  expandRelationshipNode,
  type GraphNodeType,
  type RelationshipGraph,
} from "@/services/fin/relationship-graph-service";
import { getAllFraudReports, type FraudReportView } from "@/services/fin/fraud-report-service";
import { getFinOverview, type FinOverviewMetrics } from "@/services/admin/get-fin-overview";
import {
  getGovernmentIntelligenceOverview,
  type GovernmentIntelligenceOverview,
} from "@/services/admin/get-government-intelligence-overview";

const LIVE_EVENT_LIMIT = 15;
const SOC_INVESTIGATION_QUEUE_LIMIT = 12;
const SOC_LIVE_LOGIN_LIMIT = 25;

/**
 * Backs the Admin SOC's live security event stream. Deliberately simple
 * short-interval client polling (see `FinLiveEventStream`) rather than
 * WebSockets/SSE — the pragmatic choice for a platform meant to run on
 * Vercel/Railway without a persistent-connection layer.
 */
export async function getLiveFinEventsAction(): Promise<FinEventView[]> {
  await requireAnalyst();
  return getRecentFinEvents({ limit: LIVE_EVENT_LIMIT });
}

export interface RecomputeClustersResult {
  ok: boolean;
  error?: string;
  clustersCreated?: number;
  clustersUpdated?: number;
}

/**
 * On-demand fraud clustering (see `cluster-engine.ts` for why this isn't a
 * background job). Rate-limited per-analyst so it can't be hammered into an
 * accidental DB load test.
 */
export async function recomputeClustersAction(): Promise<RecomputeClustersResult> {
  const user = await requireAnalyst();

  const rateLimit = checkRateLimit(`recompute-clusters:${user.id}`, 10, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Please wait a moment before recomputing clusters again." };
  }

  const result = await recomputeClusters();

  await logAuditEvent({
    userId: user.id,
    action: "FIN_CLUSTERS_RECOMPUTED",
    entityType: "FraudCluster",
    entityId: "all",
    metadata: result,
  });

  revalidatePath("/admin/fin/clusters");
  revalidatePath("/admin/fin/graph");
  revalidatePath("/admin/fin/overview");

  return { ok: true, ...result };
}

/**
 * Click-to-expand for the relationship graph: fetches a node's additional
 * 1-hop neighbors that weren't already pulled in by the initial
 * fraud-report-seeded graph (e.g. a user's other devices/sessions with no
 * report yet), returned as a small delta graph the client merges in.
 */
export async function expandRelationshipNodeAction(nodeId: string, nodeType: GraphNodeType): Promise<RelationshipGraph> {
  await requireAnalyst();
  return expandRelationshipNode(nodeId, nodeType);
}

export interface SocSnapshot {
  threatMap: ThreatMapData;
  liveLogins: ThreatMapData["markers"];
  graph: RelationshipGraph;
  investigationQueue: FraudReportView[];
  stats: FinOverviewMetrics;
  government: GovernmentIntelligenceOverview;
  generatedAt: string;
}

/**
 * The Admin Security Operations Center's single consolidated poll —
 * replacing what would otherwise be five-to-six separate per-panel polls
 * with one round trip every ~4s, fanned out client-side into every panel.
 * Keeps the existing "polling over WebSockets" architecture decision (see
 * `FinLiveEventStream`) while keeping every panel trivially in sync with
 * every customer login, transaction, and fraud report as they happen.
 */
export async function getSocSnapshotAction(): Promise<SocSnapshot> {
  await requireAnalyst();

  const [threatMap, graph, investigationQueue, stats, government] = await Promise.all([
    getThreatMapData(),
    getRelationshipGraph(),
    getAllFraudReports(),
    getFinOverview(),
    getGovernmentIntelligenceOverview(),
  ]);

  return {
    threatMap,
    liveLogins: threatMap.markers.slice(0, SOC_LIVE_LOGIN_LIMIT),
    graph,
    investigationQueue: investigationQueue.slice(0, SOC_INVESTIGATION_QUEUE_LIMIT),
    stats,
    government,
    generatedAt: new Date().toISOString(),
  };
}
