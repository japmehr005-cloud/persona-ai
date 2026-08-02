"use client";

import { useMemo, useState } from "react";
import { Fingerprint, Landmark, MapPin, MonitorSmartphone, Phone, Search, ShieldAlert, User, Wallet, X } from "lucide-react";

import type { GraphNodeType, RelationshipGraph } from "@/services/fin/relationship-graph-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COLUMN_ORDER: GraphNodeType[] = [
  "user",
  "device",
  "session",
  "location",
  "beneficiary",
  "fraudReport",
  "fri",
  "mnrl",
];

const COLUMN_LABELS: Record<GraphNodeType, string> = {
  user: "Users",
  device: "Devices",
  session: "Sessions",
  location: "Locations",
  beneficiary: "Recipients",
  fraudReport: "Fraud Reports",
  fri: "FRI Matches",
  mnrl: "MNRL Matches",
};

const NODE_ICONS: Record<GraphNodeType, typeof User> = {
  user: User,
  device: Fingerprint,
  session: MonitorSmartphone,
  location: MapPin,
  beneficiary: Wallet,
  fraudReport: ShieldAlert,
  fri: Landmark,
  mnrl: Phone,
};

const RISK_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "destructive",
  CRITICAL: "destructive",
};

/**
 * Force-directed graphs are hard to use on small touch screens, so mobile
 * gets this grouped list instead of the interactive `RelationshipGraphView`
 * — same underlying data, presented as entity groups rather than a canvas,
 * with the same search/type-filter controls as the desktop graph.
 */
export function RelationshipGraphMobileList({ graph }: { graph: RelationshipGraph }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleTypes, setVisibleTypes] = useState<Set<GraphNodeType>>(new Set(COLUMN_ORDER));

  function toggleType(type: GraphNodeType) {
    setVisibleTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const query = searchQuery.trim().toLowerCase();
  const hasActiveFilters = searchQuery.length > 0 || visibleTypes.size < COLUMN_ORDER.length;

  const filteredGroups = useMemo(
    () =>
      COLUMN_ORDER.map((type) => ({
        type,
        nodes: graph.nodes.filter(
          (node) => node.type === type && visibleTypes.has(type) && (query.length === 0 || node.label.toLowerCase().includes(query))
        ),
      })).filter((group) => group.nodes.length > 0),
    [graph.nodes, query, visibleTypes]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search entities…"
            className="h-9 pl-8 text-sm"
            aria-label="Search relationship graph"
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setVisibleTypes(new Set(COLUMN_ORDER));
            }}
            className="gap-1.5"
          >
            <X className="size-3.5" /> Clear
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {COLUMN_ORDER.map((type) => {
          const count = graph.nodes.filter((node) => node.type === type).length;
          if (count === 0) return null;
          const Icon = NODE_ICONS[type];
          const active = visibleTypes.has(type);
          return (
            <Badge
              key={type}
              variant="outline"
              role="button"
              tabIndex={0}
              onClick={() => toggleType(type)}
              onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && toggleType(type)}
              className={cn(
                "cursor-pointer select-none gap-1.5",
                active ? "border-primary/40 bg-primary/5 text-foreground" : "text-muted-foreground opacity-50"
              )}
            >
              <Icon className="size-3" />
              {COLUMN_LABELS[type]}
              <span className="text-[10px] text-muted-foreground">{count}</span>
            </Badge>
          );
        })}
      </div>

      {filteredGroups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No entities match your search or filters.
        </p>
      ) : (
        <div className="space-y-5">
          {filteredGroups.map(({ type, nodes }) => {
            const Icon = NODE_ICONS[type];

            return (
              <div key={type}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">{COLUMN_LABELS[type]}</p>
                  <span className="text-xs text-muted-foreground">({nodes.length})</span>
                </div>
                <ul className="space-y-2">
                  {nodes.map((node) => (
                    <li
                      key={node.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{node.label}</p>
                        {node.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{node.subtitle}</p>
                        )}
                      </div>
                      {node.riskLevel && (
                        <Badge variant={RISK_VARIANT[node.riskLevel]}>{node.riskLevel}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
