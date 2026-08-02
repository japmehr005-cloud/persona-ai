"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { Layer } from "@deck.gl/core";

import type { ThreatMapMarker } from "@/services/fin/geo-intelligence";
import { detectImpossibleTravel } from "@/services/geolocation/impossible-travel";
import { FinMapShell } from "@/components/maps/fin-map-shell";
import { DeckOverlay } from "@/components/maps/deck/deck-overlay";
import { buildAdminLayers } from "@/components/maps/deck/intel-layers";
import { buildCityHubs, buildSharedDeviceLinks } from "@/components/maps/deck/city-aggregates";
import { usePulseTime } from "@/components/maps/deck/pulse-controller";
import type { IntelArc } from "@/components/maps/deck/path-geometry";
import { resolveInitialView } from "@/components/maps/india-viewport";
import { MARKER_TONE_HEX } from "@/components/maps/marker-tones";

function buildTravelArcs(markers: ThreatMapMarker[]): IntelArc[] {
  const byUser = new Map<string, ThreatMapMarker[]>();
  for (const marker of markers) {
    const list = byUser.get(marker.userId) ?? [];
    list.push(marker);
    byUser.set(marker.userId, list);
  }

  const paths: IntelArc[] = [];
  for (const userMarkers of byUser.values()) {
    const chronological = [...userMarkers].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    for (let i = 1; i < chronological.length; i++) {
      const prev = chronological[i - 1];
      const next = chronological[i];
      const travel = detectImpossibleTravel({
        previous: { latitude: prev.latitude, longitude: prev.longitude, timestamp: prev.occurredAt },
        next: { latitude: next.latitude, longitude: next.longitude, timestamp: next.occurredAt },
      });
      if (!travel.isImpossible && travel.distanceKm < 80) continue;
      const bothTrusted =
        prev.riskColor === "green" &&
        next.riskColor === "green" &&
        prev.deviceTrusted &&
        next.deviceTrusted;
      paths.push({
        id: `${prev.id}->${next.id}`,
        fromSessionId: prev.id,
        toSessionId: next.id,
        from: { longitude: prev.longitude, latitude: prev.latitude },
        to: { longitude: next.longitude, latitude: next.latitude },
        tone: travel.isImpossible ? "impossible" : bothTrusted ? "trusted" : "normal",
        kind: "travel",
      });
    }
  }
  return paths;
}

export interface ThreatMapProps {
  markers: ThreatMapMarker[];
  selectedId: string | null;
  onSelect: (marker: ThreatMapMarker) => void;
  className?: string;
}

/**
 * Admin SOC threat map: MapLibre security canvas + deck.gl Heatmap, city hubs,
 * session scatter, travel/shared-device arcs, and TripsLayer attack animation.
 */
function ThreatMap({ markers, selectedId, onSelect, className }: ThreatMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [zoom, setZoom] = useState(4.2);
  const time = usePulseTime(true);

  const markersById = useMemo(() => new Map(markers.map((marker) => [marker.id, marker])), [markers]);
  const initialView = useMemo(() => resolveInitialView(markers), [markers]);
  const hubs = useMemo(() => buildCityHubs(markers), [markers]);
  const travelArcs = useMemo(() => buildTravelArcs(markers), [markers]);
  const sharedArcs = useMemo((): IntelArc[] => {
    return buildSharedDeviceLinks(markers).map((link) => ({
      ...link,
      tone: "normal" as const,
      kind: "shared-device" as const,
    }));
  }, [markers]);

  const layers: Layer[] = useMemo(
    () =>
      buildAdminLayers({
        markers,
        travelArcs,
        sharedArcs,
        hubs,
        selectedId,
        zoom,
        time,
        onSelectSession: (id) => {
          const marker = markersById.get(id);
          if (marker) onSelect(marker);
        },
      }),
    [markers, travelArcs, sharedArcs, hubs, selectedId, zoom, time, markersById, onSelect]
  );

  const syncViewport = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setZoom(map.getZoom());
  }, []);

  useEffect(() => {
    if (!mapRef.current || !initialView.fitBounds) return;
    mapRef.current.fitBounds(initialView.fitBounds, { padding: 72, duration: 900 });
  }, [initialView.fitBounds]);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const marker = markersById.get(selectedId);
    if (!marker) return;
    mapRef.current.flyTo({
      center: [marker.longitude, marker.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 5.5),
      duration: 700,
      essential: true,
    });
  }, [selectedId, markersById]);

  return (
    <FinMapShell
      mapRef={mapRef}
      initialViewState={{
        longitude: initialView.longitude,
        latitude: initialView.latitude,
        zoom: initialView.zoom,
      }}
      className={className}
      onLoad={syncViewport}
      onMove={syncViewport}
      onMoveEnd={syncViewport}
      legend={
        <>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: MARKER_TONE_HEX.trusted }} />
            <span className="text-slate-300">Trusted</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: MARKER_TONE_HEX.attention }} />
            <span className="text-slate-300">Attention</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: MARKER_TONE_HEX.fraud }} />
            <span className="text-slate-300">Fraud / Attack path</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-purple-400" />
            <span className="text-slate-300">Shared device</span>
          </span>
        </>
      }
    >
      <DeckOverlay layers={layers} getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")} />
    </FinMapShell>
  );
}

export { ThreatMap };
export default ThreatMap;
