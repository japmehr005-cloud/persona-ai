"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Network, Radio } from "lucide-react";

import { getSocSnapshotAction, type SocSnapshot } from "@/features/admin/fin-actions";
import { useFinLiveSync } from "@/hooks/use-fin-live-sync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SocThreatMapPanel } from "@/features/admin/soc/soc-threat-map-panel";
import { SocLiveLoginFeedPanel } from "@/features/admin/soc/soc-live-login-feed-panel";
import { SocInvestigationQueuePanel } from "@/features/admin/soc/soc-investigation-queue-panel";
import { SocThreatStatsPanel } from "@/features/admin/soc/soc-threat-stats-panel";
import { SocEntityDetailSheet } from "@/features/admin/soc/soc-entity-detail-sheet";
import { SocRelationshipGraphModal } from "@/features/admin/soc/soc-relationship-graph-modal";

const POLL_INTERVAL_MS = 5000;

/**
 * Admin SOC command center — threat map as the dominant hero canvas,
 * live incident feed as supporting rail, investigation tools secondary.
 * SSE + polling keep the snapshot live; selection sync stays in `useSocSelectionStore`.
 */
export function SocCommandCenter({ initialSnapshot }: { initialSnapshot: SocSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [isLive, setIsLive] = useState(true);
  const [graphOpen, setGraphOpen] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await getSocSnapshotAction();
      setSnapshot(next);
      setIsLive(true);
    } catch {
      setIsLive(false);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useFinLiveSync(refresh);

  useEffect(() => {
    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={isLive ? "success" : "destructive"} className="gap-1.5">
            <Radio className="size-3" />
            {isLive ? "Live" : "Reconnecting"}
          </Badge>
          <span>Updated {formatDistanceToNowStrict(new Date(snapshot.generatedAt), { addSuffix: true })}</span>
        </div>
        <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setGraphOpen(true)}>
          <Network className="size-3.5" />
          Open investigation
        </Button>
      </div>

      <SocThreatStatsPanel stats={snapshot.stats} />

      {/* Hero: Threat Map (~75%) + Live Feed (~25%) */}
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="min-h-[420px] xl:col-span-9 xl:min-h-[560px]">
          <SocThreatMapPanel data={snapshot.threatMap} />
        </div>
        <div className="min-h-[320px] xl:col-span-3 xl:min-h-[560px]">
          <SocLiveLoginFeedPanel logins={snapshot.liveLogins} />
        </div>
      </div>

      {/* Secondary: Investigation queue */}
      <div className="grid gap-3 xl:grid-cols-1">
        <SocInvestigationQueuePanel reports={snapshot.investigationQueue} />
      </div>

      <SocEntityDetailSheet snapshot={snapshot} onOpenRelationships={() => setGraphOpen(true)} />
      <SocRelationshipGraphModal graph={snapshot.graph} open={graphOpen} onOpenChange={setGraphOpen} />
    </div>
  );
}
