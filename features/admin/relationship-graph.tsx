"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import {
  Fingerprint,
  Landmark,
  MapPin,
  MonitorSmartphone,
  Phone,
  Search,
  ShieldAlert,
  User,
  Wallet,
  X,
} from "lucide-react";

import type { GraphNode, GraphNodeType, RelationshipGraph } from "@/services/fin/relationship-graph-service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const COLUMN_ORDER: GraphNodeType[] = [
  "user",
  "device",
  "session",
  "location",
  "beneficiary",
  "fraudReport",
  "fri",
  "mnrl",
];

export const COLUMN_LABELS: Record<GraphNodeType, string> = {
  user: "Users",
  device: "Devices",
  session: "Sessions",
  location: "Locations",
  beneficiary: "Recipients",
  fraudReport: "Fraud Reports",
  fri: "FRI Matches",
  mnrl: "MNRL Matches",
};

export const NODE_ICONS: Record<GraphNodeType, typeof User> = {
  user: User,
  device: Fingerprint,
  session: MonitorSmartphone,
  location: MapPin,
  beneficiary: Wallet,
  fraudReport: ShieldAlert,
  fri: Landmark,
  mnrl: Phone,
};

type AccountTone = "trusted" | "suspicious" | "fraud";

const TONE_STYLES: Record<AccountTone, string> = {
  trusted: "border-emerald-500/60 bg-emerald-500/20 text-emerald-100",
  suspicious: "border-amber-500/60 bg-amber-500/20 text-amber-100",
  fraud: "border-red-500/70 bg-red-500/25 text-red-50",
};

const TONE_GLOW: Record<AccountTone, string> = {
  trusted: "0 0 14px rgba(16,185,129,0.45)",
  suspicious: "0 0 16px rgba(245,158,11,0.5)",
  fraud: "0 0 20px rgba(239,68,68,0.6)",
};

const RISK_RANK: Record<NonNullable<GraphNode["riskLevel"]>, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

type FinFlowNodeData = { graphNode: GraphNode; tone: AccountTone; dimmed: boolean; selected: boolean };

function shortLabel(label: string): string {
  const cleaned = label.trim();
  if (cleaned.length <= 16) return cleaned;
  return `${cleaned.slice(0, 14)}…`;
}

function toneForUser(user: GraphNode, fullGraph: RelationshipGraph): AccountTone {
  let worst: NonNullable<GraphNode["riskLevel"]> | undefined = user.riskLevel;
  for (const edge of fullGraph.edges) {
    const otherId = edge.source === user.id ? edge.target : edge.target === user.id ? edge.source : null;
    if (!otherId) continue;
    const other = fullGraph.nodes.find((n) => n.id === otherId);
    if (!other?.riskLevel) continue;
    if (!worst || RISK_RANK[other.riskLevel] > RISK_RANK[worst]) worst = other.riskLevel;
  }
  if (worst === "CRITICAL" || worst === "HIGH") return "fraud";
  if (worst === "MEDIUM") return "suspicious";
  return "trusted";
}

/**
 * Collapse the full FIN graph to account-only nodes with user↔user edges
 * when accounts share a device, beneficiary, report, or similar-device hop.
 */
function collapseToAccountGraph(full: RelationshipGraph): {
  users: GraphNode[];
  edges: Array<{ id: string; source: string; target: string; label: string; dashed?: boolean }>;
} {
  const users = full.nodes.filter((n) => n.type === "user");
  const userIds = new Set(users.map((u) => u.id));

  const adjacency = new Map<string, Set<string>>();
  for (const node of full.nodes) adjacency.set(node.id, new Set());
  for (const edge of full.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const linkKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const links = new Map<string, { source: string; target: string; label: string; dashed?: boolean }>();

  function connectUsers(a: string, b: string, label: string, dashed?: boolean) {
    if (a === b || !userIds.has(a) || !userIds.has(b)) return;
    const key = linkKey(a, b);
    const existing = links.get(key);
    if (!existing) {
      links.set(key, { source: a, target: b, label, dashed });
      return;
    }
    if (existing.dashed && !dashed) links.set(key, { source: a, target: b, label, dashed: false });
  }

  // Direct user–user edges (rare) + 1-hop via shared intermediary
  for (const edge of full.edges) {
    if (userIds.has(edge.source) && userIds.has(edge.target)) {
      connectUsers(edge.source, edge.target, edge.label ?? "linked", edge.dashed);
    }
  }

  for (const mid of full.nodes) {
    if (mid.type === "user") continue;
    const neighbors = [...(adjacency.get(mid.id) ?? [])].filter((id) => userIds.has(id));
    if (neighbors.length < 2) continue;
    const label =
      mid.type === "device"
        ? "shared device"
        : mid.type === "beneficiary"
          ? "shared recipient"
          : mid.type === "fraudReport"
            ? "linked report"
            : mid.type === "fri" || mid.type === "mnrl"
              ? "gov match"
              : "linked";
    const dashed = mid.type === "device" || mid.type === "beneficiary";
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        connectUsers(neighbors[i], neighbors[j], label, dashed);
      }
    }
  }

  // 2-hop via device similarity: user-A — device-A ~ device-B — user-B
  for (const edge of full.edges) {
    if (!edge.dashed && edge.label !== "similar device") continue;
    const aNeighbors = [...(adjacency.get(edge.source) ?? [])].filter((id) => userIds.has(id));
    const bNeighbors = [...(adjacency.get(edge.target) ?? [])].filter((id) => userIds.has(id));
    for (const ua of aNeighbors) {
      for (const ub of bNeighbors) {
        connectUsers(ua, ub, "similar device", true);
      }
    }
  }

  return {
    users,
    edges: [...links.values()].map((link) => ({
      id: `account:${link.source}->${link.target}`,
      ...link,
    })),
  };
}

function structureKey(users: GraphNode[], edges: Array<{ id: string }>): string {
  const nodePart = users
    .map((u) => u.id)
    .sort()
    .join(",");
  const edgePart = edges
    .map((e) => e.id)
    .sort()
    .join(",");
  return `${nodePart}||${edgePart}`;
}

function computeDagreLayout(
  users: GraphNode[],
  edges: Array<{ id: string; source: string; target: string }>
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 56, ranksep: 90, marginx: 24, marginy: 24 });

  for (const user of users) {
    g.setNode(user.id, { width: 88, height: 72 });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const user of users) {
    const node = g.node(user.id);
    positions.set(user.id, {
      x: (node?.x ?? 0) - 44,
      y: (node?.y ?? 0) - 36,
    });
  }
  return positions;
}

function FinFlowNode({ data }: NodeProps<Node<FinFlowNodeData>>) {
  const { graphNode, tone, dimmed, selected } = data;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex w-[80px] flex-col items-center gap-0.5 transition-opacity duration-200",
            dimmed && "opacity-20"
          )}
        >
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-full border-2 bg-slate-900/90 shadow-md",
              TONE_STYLES[tone],
              selected && "scale-110 ring-2 ring-sky-400/80 ring-offset-2 ring-offset-[#0b1220]"
            )}
            style={{
              boxShadow: selected ? "0 0 20px rgba(56,189,248,0.55)" : TONE_GLOW[tone],
            }}
          >
            <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-slate-500" />
            <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-slate-500" />
            <User className="size-3.5" />
          </div>
          <span className="max-w-full truncate text-center text-[9px] font-medium leading-tight text-slate-200">
            {shortLabel(graphNode.label)}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        <p className="font-medium">{graphNode.label}</p>
        <p className="capitalize text-muted-foreground">{tone} account</p>
      </TooltipContent>
    </Tooltip>
  );
}

const nodeTypes = { finNode: FinFlowNode };

export interface RelationshipGraphViewProps {
  graph: RelationshipGraph;
  height?: number;
  externalSelectedId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  hideLegend?: boolean;
}

export function RelationshipGraphView({
  graph,
  height = 560,
  externalSelectedId,
  onNodeSelect,
  hideLegend = false,
}: RelationshipGraphViewProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const isControlled = externalSelectedId !== undefined;
  const selectedId = isControlled ? externalSelectedId : internalSelectedId;

  const [fullGraph, setFullGraph] = useState(graph);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [frozenLayout, setFrozenLayout] = useState<{
    key: string;
    positions: Map<string, { x: number; y: number }>;
  } | null>(null);

  useEffect(() => {
    setFullGraph(graph);
  }, [graph]);

  // Map session:/device: selection from SOC onto owning user node when possible.
  const resolvedSelectedUserId = useMemo(() => {
    if (!selectedId) return null;
    if (selectedId.startsWith("user:")) return selectedId;
    for (const edge of fullGraph.edges) {
      if (edge.source === selectedId && edge.target.startsWith("user:")) return edge.target;
      if (edge.target === selectedId && edge.source.startsWith("user:")) return edge.source;
    }
    // Walk one hop from session/device to user
    const neighbors = fullGraph.edges
      .filter((e) => e.source === selectedId || e.target === selectedId)
      .map((e) => (e.source === selectedId ? e.target : e.source));
    for (const mid of neighbors) {
      for (const edge of fullGraph.edges) {
        if (edge.source === mid && edge.target.startsWith("user:")) return edge.target;
        if (edge.target === mid && edge.source.startsWith("user:")) return edge.source;
      }
    }
    return null;
  }, [selectedId, fullGraph]);

  const accountGraph = useMemo(() => collapseToAccountGraph(fullGraph), [fullGraph]);
  const layoutKey = useMemo(
    () => structureKey(accountGraph.users, accountGraph.edges),
    [accountGraph.users, accountGraph.edges]
  );

  useEffect(() => {
    if (frozenLayout?.key === layoutKey) return;
    const positions = computeDagreLayout(accountGraph.users, accountGraph.edges);
    setFrozenLayout({ key: layoutKey, positions });
  }, [layoutKey, accountGraph.users, accountGraph.edges, frozenLayout?.key]);

  const positions = useMemo(
    () => frozenLayout?.positions ?? new Map<string, { x: number; y: number }>(),
    [frozenLayout?.positions]
  );

  const { nodes, edges } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const neighborIds = new Set<string>();
    if (resolvedSelectedUserId) {
      for (const edge of accountGraph.edges) {
        if (edge.source === resolvedSelectedUserId) neighborIds.add(edge.target);
        if (edge.target === resolvedSelectedUserId) neighborIds.add(edge.source);
      }
    }

    const flowNodes: Node<FinFlowNodeData>[] = accountGraph.users.map((user) => {
      const isSelected = resolvedSelectedUserId === user.id;
      const isNeighbor = neighborIds.has(user.id);
      const matchesSearch = query.length === 0 || user.label.toLowerCase().includes(query);
      const dimmed =
        (resolvedSelectedUserId !== null && !isSelected && !isNeighbor) || (query.length > 0 && !matchesSearch);

      return {
        id: user.id,
        type: "finNode",
        position: positions.get(user.id) ?? { x: 0, y: 0 },
        data: {
          graphNode: user,
          tone: toneForUser(user, fullGraph),
          dimmed,
          selected: isSelected,
        },
        draggable: false,
      };
    });

    const flowEdges: Edge[] = accountGraph.edges.map((edge) => {
      const isActive =
        resolvedSelectedUserId !== null &&
        (edge.source === resolvedSelectedUserId || edge.target === resolvedSelectedUserId);
      const dimmed = resolvedSelectedUserId !== null && !isActive;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: isActive,
        label: isActive ? edge.label : undefined,
        style: {
          stroke: isActive ? "#38bdf8" : "#475569",
          strokeWidth: isActive ? 2.5 : 1.25,
          opacity: dimmed ? 0.12 : isActive ? 1 : 0.55,
          strokeDasharray: edge.dashed ? "5 4" : undefined,
        },
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [accountGraph, positions, resolvedSelectedUserId, searchQuery, fullGraph]);

  const detailNode = fullGraph.nodes.find((node) => node.id === detailNodeId) ?? null;

  const detailConnections = useMemo(() => {
    if (!detailNode) return [];
    return fullGraph.edges
      .filter((edge) => edge.source === detailNode.id || edge.target === detailNode.id)
      .map((edge) => {
        const otherId = edge.source === detailNode.id ? edge.target : edge.source;
        const otherNode = fullGraph.nodes.find((node) => node.id === otherId);
        return { edge, otherNode };
      })
      .filter((entry): entry is { edge: (typeof fullGraph.edges)[number]; otherNode: GraphNode } =>
        Boolean(entry.otherNode)
      );
  }, [detailNode, fullGraph]);

  const detailByType = useMemo(() => {
    const groups: Partial<Record<GraphNodeType, GraphNode[]>> = {};
    for (const { otherNode } of detailConnections) {
      const list = groups[otherNode.type] ?? [];
      list.push(otherNode);
      groups[otherNode.type] = list;
    }
    return groups;
  }, [detailConnections]);

  function setSelectedId(next: string | null) {
    if (!isControlled) setInternalSelectedId(next);
    onNodeSelect?.(next);
  }

  function handleNodeClick(nodeId: string) {
    setSelectedId(nodeId);
    setDetailNodeId(nodeId);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {!hideLegend && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search accounts…"
                  className="h-8 w-44 pl-8 text-sm"
                  aria-label="Search relationship graph"
                />
              </div>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
                Trusted
              </Badge>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
                Suspicious
              </Badge>
              <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200">
                Confirmed fraud
              </Badge>
              <span className="text-xs text-muted-foreground">
                {accountGraph.users.length} accounts · click for intelligence
              </span>
            </div>
            {(searchQuery || resolvedSelectedUserId) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedId(null);
                  setDetailNodeId(null);
                }}
                className="h-8 gap-1.5 text-xs"
              >
                <X className="size-3.5" /> Clear
              </Button>
            )}
          </div>
        )}

        <div className="w-full overflow-hidden rounded-xl border border-border/60 bg-[#0b1220]" style={{ height }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_event, node) => handleNodeClick(node.id)}
            onPaneClick={() => {
              setSelectedId(null);
              setDetailNodeId(null);
            }}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
          >
            <Background gap={28} color="#1e293b" size={1} />
            <Controls showInteractive={false} className="!border-white/10 !bg-slate-900/80 !shadow-none" />
            {!hideLegend && (
              <MiniMap
                pannable
                zoomable
                className="!border-white/10 !bg-slate-950/80"
                nodeColor={(node) => {
                  const tone = (node.data as FinFlowNodeData).tone;
                  if (tone === "fraud") return "#ef4444";
                  if (tone === "suspicious") return "#f59e0b";
                  return "#22c55e";
                }}
              />
            )}
          </ReactFlow>
        </div>

        <Sheet open={detailNode !== null} onOpenChange={(open) => !open && setDetailNodeId(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md" side="right">
            {detailNode && (
              <>
                <SheetHeader>
                  <SheetTitle>{detailNode.label}</SheetTitle>
                  <SheetDescription>
                    {detailNode.type === "user" ? "Customer account intelligence" : COLUMN_LABELS[detailNode.type]}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 px-6 pb-6">
                  {detailNode.type === "user" && (
                    <Badge variant="outline" className={cn("w-fit", TONE_STYLES[toneForUser(detailNode, fullGraph)])}>
                      {toneForUser(detailNode, fullGraph)} account
                    </Badge>
                  )}
                  {detailNode.subtitle && <p className="text-sm text-muted-foreground">{detailNode.subtitle}</p>}

                  <Separator />

                  {(
                    [
                      ["session", "Login history / sessions"],
                      ["device", "Linked devices"],
                      ["location", "Locations"],
                      ["fraudReport", "Fraud reports"],
                      ["beneficiary", "Recipients"],
                      ["fri", "FRI hits"],
                      ["mnrl", "MNRL hits"],
                    ] as const
                  ).map(([type, title]) => {
                    const items = detailByType[type] ?? [];
                    return (
                      <div key={type}>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {title} ({items.length})
                        </p>
                        {items.length === 0 ? (
                          <p className="text-sm text-muted-foreground">None linked in current FIN graph.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {items.map((item) => {
                              const Icon = NODE_ICONS[item.type];
                              return (
                                <li
                                  key={item.id}
                                  className="flex items-start gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-sm"
                                >
                                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium text-foreground">{item.label}</span>
                                    {item.subtitle && (
                                      <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                                    )}
                                    {item.riskLevel && (
                                      <Badge variant="outline" className="mt-1 text-[10px]">
                                        {item.riskLevel}
                                      </Badge>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
