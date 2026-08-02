"use client";

import Link from "next/link";
import { Maximize2, Network } from "lucide-react";

import type { RelationshipGraph } from "@/services/fin/relationship-graph-service";
import { useSocSelectionStore, type SocEntityType } from "@/stores/soc-selection-store";
import { Button } from "@/components/ui/button";
import { RelationshipGraphView } from "@/components/charts/admin-fin-graph";

const GRAPH_TYPE_TO_ENTITY_TYPE: Partial<Record<string, SocEntityType>> = {
  session: "session",
  device: "device",
  user: "user",
  fraudReport: "fraudReport",
  beneficiary: "beneficiary",
};

export function SocRelationshipGraphPanel({ graph }: { graph: RelationshipGraph }) {
  const selection = useSocSelectionStore((state) => state.selection);
  const select = useSocSelectionStore((state) => state.select);

  const graphSelectedId = selection ? `${selection.type}:${selection.id}` : null;

  function handleNodeSelect(nodeId: string | null) {
    if (!nodeId) return;
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    const entityType = GRAPH_TYPE_TO_ENTITY_TYPE[node.type];
    if (!entityType) return;
    select({ type: entityType, id: nodeId.split(":").slice(1).join(":"), label: node.label });
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Network className="size-4 text-muted-foreground" />
            Relationship graph
          </h2>
          <p className="truncate text-xs text-muted-foreground">Correlated entities — click a node for detail</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="h-8 shrink-0 text-xs">
          <Link href="/admin/fin/graph">
            <Maximize2 className="size-3.5" />
            Full screen
          </Link>
        </Button>
      </header>
      <div className="min-h-0 flex-1 p-2">
        {graph.nodes.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground xl:h-[340px]">
            No fraud-linked entities yet.
          </div>
        ) : (
          <RelationshipGraphView
            graph={graph}
            height={300}
            hideLegend
            externalSelectedId={graphSelectedId}
            onNodeSelect={handleNodeSelect}
          />
        )}
      </div>
    </section>
  );
}
