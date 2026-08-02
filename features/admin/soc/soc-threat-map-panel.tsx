"use client";

import dynamic from "next/dynamic";
import { Globe2 } from "lucide-react";

import type { ThreatMapData, ThreatMapMarker } from "@/services/fin/geo-intelligence";
import { useSocSelectionStore } from "@/stores/soc-selection-store";
import { toIncidentId } from "@/lib/incident-id";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const ThreatMap = dynamic(() => import("@/components/maps/threat-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full bg-[#0b1220]" />,
});

export function SocThreatMapPanel({ data }: { data: ThreatMapData }) {
  const selection = useSocSelectionStore((state) => state.selection);
  const select = useSocSelectionStore((state) => state.select);

  function handleSelect(marker: ThreatMapMarker) {
    select({
      type: "session",
      id: marker.id,
      label: `${toIncidentId(marker.id)} · ${marker.userName}`,
    });
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-[#0b1220]">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-50">
            <Globe2 className="size-4 text-sky-400" />
            Threat map
          </h2>
          <p className="truncate text-xs text-slate-400">Live sign-ins across every customer</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Badge variant="outline" className="border-white/15 text-slate-200">
            {data.cityCount} cities
          </Badge>
          <Badge variant={data.suspiciousCount > 0 ? "destructive" : "outline"} className="border-white/15">
            {data.suspiciousCount} flagged
          </Badge>
        </div>
      </header>
      <div className="min-h-0 flex-1 p-1">
        <ThreatMap
          markers={data.markers}
          selectedId={selection?.type === "session" ? selection.id : null}
          onSelect={handleSelect}
          className="h-full rounded-xl border-0"
        />
      </div>
    </section>
  );
}
