"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { History, PanelRightOpen } from "lucide-react";

import type { SecurityMapData } from "@/services/fin/geo-intelligence";
import { getSecurityMapAction } from "@/features/security/security-map-actions";
import { useFinLiveSync } from "@/hooks/use-fin-live-sync";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LoginTimeline } from "@/features/security/login-timeline";
import { LoginIntelPanel } from "@/features/security/login-intel-panel";

// Load the map module by file path only — never import a page route.
// Default-export wrapper avoids `.then(m => m.SecurityMap)` chunk edge cases.
const SecurityMap = dynamic(() => import("@/components/maps/security-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full bg-[#0b1220]" />,
});

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export interface LoginMapPanelProps {
  data: SecurityMapData;
}

/**
 * NordVPN-style Security Intelligence composition: hero map canvas with a
 * floating timeline rail and progressive-disclosure intel panel. SSE keeps
 * markers live without a page refresh.
 */
export function LoginMapPanel({ data: initialData }: LoginMapPanelProps) {
  const isDesktop = useIsDesktop();
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState<string | null>(initialData.markers[0]?.id ?? null);
  const [intelOpen, setIntelOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const refresh = useCallback(async () => {
    const next = await getSecurityMapAction();
    setData(next);
    setSelectedId((current) => {
      if (current && next.markers.some((marker) => marker.id === current)) return current;
      return next.markers[0]?.id ?? null;
    });
  }, []);

  useFinLiveSync(refresh);

  const selectedMarker = data.markers.find((marker) => marker.id === selectedId) ?? null;

  function handleSelect(id: string) {
    setSelectedId(id);
    setIntelOpen(true);
    if (!isDesktop) setTimelineOpen(false);
  }

  return (
    <div className="relative h-[70vh] min-h-[480px] w-full overflow-hidden rounded-2xl border border-border/60 bg-[#0b1220] shadow-sm lg:h-[75vh]">
      <SecurityMap markers={data.markers} path={data.path} selectedId={selectedId} onSelect={handleSelect} className="h-full rounded-none border-0" />

      {/* Desktop floating timeline rail */}
      <aside className="pointer-events-auto absolute bottom-4 left-4 top-4 z-20 hidden w-[300px] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/92 shadow-2xl backdrop-blur md:flex">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-50">Login timeline</p>
            <p className="text-xs text-slate-400">{data.markers.length} sessions</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-slate-300"
            onClick={() => setIntelOpen(true)}
            aria-label="Open intelligence panel"
          >
            <PanelRightOpen className="size-4" />
          </Button>
        </div>
        <LoginTimeline markers={data.markers} selectedId={selectedId} onSelect={handleSelect} className="min-h-0 flex-1" />
      </aside>

      <LoginIntelPanel
        marker={selectedMarker}
        open={intelOpen}
        onOpenChange={setIntelOpen}
        variant={isDesktop ? "rail" : "sheet"}
      />

      {/* Mobile timeline trigger + bottom sheet */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex gap-2 md:hidden">
        <Button
          className="flex-1 bg-slate-900/90 text-slate-100 backdrop-blur"
          variant="secondary"
          onClick={() => setTimelineOpen(true)}
        >
          <History className="size-4" />
          Timeline
        </Button>
        <Button
          className="flex-1 bg-slate-900/90 text-slate-100 backdrop-blur"
          variant="secondary"
          onClick={() => setIntelOpen(true)}
          disabled={!selectedMarker}
        >
          <PanelRightOpen className="size-4" />
          Details
        </Button>
      </div>

      <Sheet open={timelineOpen} onOpenChange={setTimelineOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl border-white/10 bg-[#0b1220] p-0 text-slate-100 md:hidden">
          <SheetHeader className="border-b border-white/10 px-4 py-3">
            <SheetTitle className="text-slate-50">Login timeline</SheetTitle>
          </SheetHeader>
          <LoginTimeline
            markers={data.markers}
            selectedId={selectedId}
            onSelect={handleSelect}
            className="h-[calc(100%-57px)]"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
