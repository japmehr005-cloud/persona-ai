"use client";

import { Network } from "lucide-react";

import type { RelationshipGraph } from "@/services/fin/relationship-graph-service";
import { useSocSelectionStore, type SocEntityType } from "@/stores/soc-selection-store";
import { RelationshipGraphView } from "@/components/charts/admin-fin-graph";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GRAPH_TYPE_TO_ENTITY_TYPE: Partial<Record<string, SocEntityType>> = {
  session: "session",
  device: "device",
  user: "user",
  fraudReport: "fraudReport",
  beneficiary: "beneficiary",
};

export interface SocRelationshipGraphModalProps {
  graph: RelationshipGraph;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Large investigation canvas — opened from the drawer, not a dashboard widget. */
export function SocRelationshipGraphModal({ graph, open, onOpenChange }: SocRelationshipGraphModalProps) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[min(96vw,1400px)] max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1400px]">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Network className="size-4 text-muted-foreground" />
            Relationship investigation
          </DialogTitle>
          <DialogDescription>
            Explore linked users, devices, sessions, and fraud reports for the selected incident.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 p-2">
          {graph.nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No fraud-linked entities yet.
            </div>
          ) : (
            <RelationshipGraphView
              graph={graph}
              height={720}
              hideLegend={false}
              externalSelectedId={graphSelectedId}
              onNodeSelect={handleNodeSelect}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
