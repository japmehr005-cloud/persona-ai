"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { BBox, Feature, Point } from "geojson";
import type { Layer } from "@deck.gl/core";

import type { SecurityMapMarker, SecurityMapPathSegment } from "@/services/fin/geo-intelligence";
import { FinMapShell } from "@/components/maps/fin-map-shell";
import { DeckOverlay } from "@/components/maps/deck/deck-overlay";
import {
  buildCustomerLayers,
  markersToScatterPoints,
  pathSegmentsToArcs,
  type ScatterPoint,
} from "@/components/maps/deck/intel-layers";
import { usePulseTime } from "@/components/maps/deck/pulse-controller";
import { resolveInitialView } from "@/components/maps/india-viewport";
import { toneForMarker, MARKER_TONE_HEX } from "@/components/maps/marker-tones";
import { useSupercluster, type ClusterPointProperties } from "@/components/maps/use-supercluster";
import { useAccessibilityOptional } from "@/features/accessibility/accessibility-provider";

export interface SecurityMapProps {
  markers: SecurityMapMarker[];
  path?: SecurityMapPathSegment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Customer Security Intelligence canvas: MapLibre geography + deck.gl GPU
 * layers for glowing nodes, sequence badges, and great-circle travel arcs.
 */
function SecurityMap({ markers, path = [], selectedId, onSelect, className }: SecurityMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [zoom, setZoom] = useState(4.2);
  const [bounds, setBounds] = useState<BBox | null>(null);
  const time = usePulseTime(true);
  const a11y = useAccessibilityOptional();
  const markerScale = a11y?.largeText || a11y?.seniorMode ? 1.45 : 1;

  const initialView = useMemo(() => resolveInitialView(markers), [markers]);

  const points = useMemo(
    () =>
      markers.map(
        (marker): Feature<Point, ClusterPointProperties> => ({
          type: "Feature",
          properties: { id: marker.id },
          geometry: { type: "Point", coordinates: [marker.longitude, marker.latitude] },
        })
      ),
    [markers]
  );

  const { clusters, index } = useSupercluster(points, { bounds, zoom, radius: 52, maxZoom: 14 });
  const markersById = useMemo(() => new Map(markers.map((marker) => [marker.id, marker])), [markers]);

  const scatterPoints = useMemo((): ScatterPoint[] => {
    const source = clusters.length > 0 ? clusters : null;
    if (!source) {
      return markersToScatterPoints(markers, selectedId);
    }

    const result: ScatterPoint[] = [];
    for (const cluster of source) {
      const [longitude, latitude] = cluster.geometry.coordinates;
      const isCluster = Boolean(cluster.properties.cluster);
      const clusterId = cluster.properties.cluster_id;

      if (isCluster && typeof clusterId === "number") {
        result.push({
          id: `cluster-${clusterId}`,
          position: [longitude, latitude],
          tone: "current",
          kind: "cluster",
          count: cluster.properties.point_count ?? 0,
          radiusPx: Math.round(16 * markerScale),
          label: `${cluster.properties.point_count ?? 0} login sessions`,
        });
        continue;
      }

      const marker = markersById.get(String(cluster.properties.id));
      if (!marker) continue;
      const tone = toneForMarker(marker);
      const selected = marker.id === selectedId;
      result.push({
        id: marker.id,
        position: [marker.longitude, marker.latitude],
        tone,
        sequenceNumber: marker.sequenceNumber,
        kind: "point",
        radiusPx: Math.round((selected ? 18 : marker.isCurrent ? 14 : 11) * markerScale),
        label: `Login ${marker.sequenceNumber} · ${marker.city ?? "unknown"}`,
      });
    }
    return result;
  }, [clusters, markers, markersById, selectedId, markerScale]);

  const arcs = useMemo(() => pathSegmentsToArcs(markers, path), [markers, path]);

  const layers: Layer[] = useMemo(
    () =>
      buildCustomerLayers({
        points: scatterPoints,
        arcs,
        selectedId,
        time,
        onSelectPoint: onSelect,
        onSelectCluster: (id, longitude, latitude) => {
          const clusterId = Number(id.replace("cluster-", ""));
          if (!Number.isFinite(clusterId)) return;
          const expansionZoom = Math.min(index.getClusterExpansionZoom(clusterId), 12);
          mapRef.current?.easeTo({
            center: [longitude, latitude],
            zoom: expansionZoom,
            duration: 500,
          });
        },
      }),
    [scatterPoints, arcs, selectedId, time, onSelect, index]
  );

  const syncViewport = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setZoom(map.getZoom());
    const b = map.getBounds();
    setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !initialView.fitBounds) return;
    mapRef.current.fitBounds(initialView.fitBounds, { padding: 64, duration: 900 });
  }, [initialView.fitBounds]);

  useEffect(() => {
    if (!selectedId) return;
    const marker = markersById.get(selectedId);
    if (!marker || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [marker.longitude, marker.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 5.8),
      duration: 900,
      essential: true,
    });
  }, [selectedId, markersById]);

  return (
    <FinMapShell
      mapRef={mapRef}
      initialViewState={initialView}
      className={className}
      onLoad={syncViewport}
      onMove={syncViewport}
      onMoveEnd={syncViewport}
      legend={
        <>
          {(
            [
              ["trusted", "Trusted"],
              ["current", "Current session"],
              ["attention", "Requires attention"],
              ["fraud", "Fraud / Impossible travel"],
            ] as const
          ).map(([tone, label]) => (
            <span key={tone} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: MARKER_TONE_HEX[tone] }} />
              <span className="text-slate-300">{label}</span>
            </span>
          ))}
        </>
      }
    >
      <DeckOverlay layers={layers} getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")} />
    </FinMapShell>
  );
}

export { SecurityMap };
export default SecurityMap;
