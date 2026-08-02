import { ScatterplotLayer, ArcLayer, TextLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import type { Layer, PickingInfo } from "@deck.gl/core";

import type { SecurityMapMarker, SecurityMapPathSegment, ThreatMapMarker } from "@/services/fin/geo-intelligence";
import { MARKER_TONE_HEX, toneForMarker, type SecurityMarkerTone } from "@/components/maps/marker-tones";
import {
  buildTripFromArc,
  hexToRgba,
  PATH_TONE_COLORS,
  type IntelArc,
} from "@/components/maps/deck/path-geometry";
import { pulseWave } from "@/components/maps/deck/pulse-controller";
import type { CityHub } from "@/components/maps/deck/city-aggregates";
import { toIncidentId } from "@/lib/incident-id";

export interface ScatterPoint {
  id: string;
  position: [number, number];
  tone: SecurityMarkerTone;
  sequenceNumber?: number;
  /** Admin SOC display code (INC-xxx). */
  incidentId?: string;
  kind: "point" | "cluster" | "hub";
  count?: number;
  cityLabel?: string;
  radiusPx: number;
  label: string;
}

function toneColor(tone: SecurityMarkerTone, alpha: number): [number, number, number, number] {
  return hexToRgba(MARKER_TONE_HEX[tone], alpha);
}

export function markersToScatterPoints(markers: SecurityMapMarker[], selectedId: string | null): ScatterPoint[] {
  return markers.map((marker) => {
    const tone = toneForMarker(marker);
    const selected = marker.id === selectedId;
    return {
      id: marker.id,
      position: [marker.longitude, marker.latitude],
      tone,
      sequenceNumber: marker.sequenceNumber,
      kind: "point" as const,
      radiusPx: selected ? 18 : marker.isCurrent ? 14 : 11,
      label: `Login ${marker.sequenceNumber} · ${marker.city ?? "unknown"}`,
    };
  });
}

export function pathSegmentsToArcs(
  markers: SecurityMapMarker[],
  path: SecurityMapPathSegment[]
): IntelArc[] {
  const byId = new Map(markers.map((m) => [m.id, m]));
  const arcs: IntelArc[] = [];
  for (const segment of path) {
    const from = byId.get(segment.fromSessionId);
    const to = byId.get(segment.toSessionId);
    if (!from || !to) continue;
    arcs.push({
      id: `${segment.fromSessionId}->${segment.toSessionId}`,
      fromSessionId: segment.fromSessionId,
      toSessionId: segment.toSessionId,
      from: { longitude: from.longitude, latitude: from.latitude },
      to: { longitude: to.longitude, latitude: to.latitude },
      tone: segment.tone,
      kind: "travel",
    });
  }
  return arcs;
}

export function buildCustomerLayers(input: {
  points: ScatterPoint[];
  arcs: IntelArc[];
  selectedId: string | null;
  time: number;
  onSelectPoint: (id: string) => void;
  onSelectCluster?: (id: string, longitude: number, latitude: number, count: number) => void;
}): Layer[] {
  const { points, arcs, selectedId, time, onSelectPoint, onSelectCluster } = input;
  const wave = pulseWave(time, 1.7);
  const pulsePoints = points.filter(
    (p) => p.kind === "point" && (p.tone === "current" || p.tone === "fraud" || p.id === selectedId)
  );

  return [
    new ArcLayer<IntelArc>({
      id: "customer-arcs",
      data: arcs,
      getSourcePosition: (d) => [d.from.longitude, d.from.latitude],
      getTargetPosition: (d) => [d.to.longitude, d.to.latitude],
      getSourceColor: (d) => {
        const selected = selectedId !== null && (d.fromSessionId === selectedId || d.toSessionId === selectedId);
        const dimmed = selectedId !== null && !selected;
        const base = hexToRgba(PATH_TONE_COLORS[d.tone], d.tone === "impossible" ? 220 : dimmed ? 60 : 180);
        return selected ? hexToRgba(PATH_TONE_COLORS[d.tone], 255) : base;
      },
      getTargetColor: (d) => {
        const selected = selectedId !== null && (d.fromSessionId === selectedId || d.toSessionId === selectedId);
        const dimmed = selectedId !== null && !selected;
        return hexToRgba(PATH_TONE_COLORS[d.tone], d.tone === "impossible" ? 240 : dimmed ? 50 : 160);
      },
      getWidth: (d) => {
        const selected = selectedId !== null && (d.fromSessionId === selectedId || d.toSessionId === selectedId);
        if (d.tone === "impossible") return selected ? 5 : 3.5;
        if (d.tone === "trusted") return selected ? 2 : 1.2;
        return selected ? 3 : 2;
      },
      greatCircle: true,
      pickable: false,
    }),

    new ScatterplotLayer<ScatterPoint>({
      id: "customer-glow",
      data: points,
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusPx * 2.4,
      radiusUnits: "pixels",
      getFillColor: (d) => toneColor(d.tone, d.id === selectedId ? 90 : 45),
      stroked: false,
      pickable: false,
    }),

    new ScatterplotLayer<ScatterPoint>({
      id: "customer-pulse",
      data: pulsePoints,
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusPx * (1.6 + wave * 1.8),
      radiusUnits: "pixels",
      getFillColor: (d) => toneColor(d.tone, Math.round(70 * (1 - wave))),
      stroked: false,
      pickable: false,
      updateTriggers: { getRadius: time, getFillColor: time },
    }),

    new ScatterplotLayer<ScatterPoint>({
      id: "customer-core",
      data: points,
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusPx,
      radiusUnits: "pixels",
      getFillColor: (d) => (d.kind === "cluster" ? [15, 23, 42, 240] : toneColor(d.tone, 255)),
      getLineColor: (d) => (d.id === selectedId ? [255, 255, 255, 255] : toneColor(d.tone, 220)),
      getLineWidth: (d) => (d.id === selectedId ? 3 : 1.5),
      lineWidthUnits: "pixels",
      stroked: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 80],
      onClick: (info: PickingInfo<ScatterPoint>) => {
        const d = info.object;
        if (!d) return;
        if (d.kind === "cluster") {
          onSelectCluster?.(d.id, d.position[0], d.position[1], d.count ?? 0);
          return;
        }
        onSelectPoint(d.id);
      },
    }),

    new ScatterplotLayer<ScatterPoint>({
      id: "customer-selected-ring",
      data: points.filter((p) => p.id === selectedId),
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusPx * (2.2 + wave * 0.8),
      radiusUnits: "pixels",
      getFillColor: [0, 0, 0, 0],
      getLineColor: (d) => toneColor(d.tone, Math.round(200 - wave * 120)),
      getLineWidth: 2.5,
      lineWidthUnits: "pixels",
      stroked: true,
      filled: false,
      pickable: false,
      updateTriggers: { getRadius: time, getLineColor: time },
    }),

    new TextLayer<ScatterPoint>({
      id: "customer-sequence",
      data: points.filter((p) => p.kind === "point" && typeof p.sequenceNumber === "number"),
      getPosition: (d) => d.position,
      getText: (d) => String(d.sequenceNumber),
      getSize: (d) => (d.id === selectedId ? 13 : 11),
      getColor: [11, 18, 32, 255],
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      fontWeight: 700,
      fontFamily: "Geist, Inter, system-ui, sans-serif",
      pickable: false,
    }),

    new TextLayer<ScatterPoint>({
      id: "customer-cluster-count",
      data: points.filter((p) => p.kind === "cluster"),
      getPosition: (d) => d.position,
      getText: (d) => String(d.count ?? 0),
      getSize: 12,
      getColor: [226, 232, 240, 255],
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      fontWeight: 600,
      pickable: false,
    }),
  ];
}

export function threatMarkersToPoints(markers: ThreatMapMarker[], selectedId: string | null, zoom: number): ScatterPoint[] {
  // At low zoom, hide individual points (city hubs + heatmap carry the story).
  if (zoom < 5.2) return [];
  return markers.map((marker) => {
    const tone = toneForMarker(marker);
    const selected = marker.id === selectedId;
    const incidentId = toIncidentId(marker.id);
    return {
      id: marker.id,
      position: [marker.longitude, marker.latitude] as [number, number],
      tone,
      kind: "point" as const,
      incidentId,
      radiusPx: selected ? 14 : 8,
      label: `${incidentId} · ${marker.userName} · ${marker.city ?? "Unknown"}`,
    };
  });
}

export function cityHubsToPoints(hubs: CityHub[], selectedId: string | null): ScatterPoint[] {
  return hubs.map((hub) => ({
    id: hub.id,
    position: [hub.longitude, hub.latitude] as [number, number],
    tone: hub.tone,
    kind: "hub" as const,
    count: hub.count,
    cityLabel: hub.city,
    radiusPx: Math.min(36, 12 + Math.sqrt(hub.count) * 5) + (selectedId === hub.id ? 4 : 0),
    label: `${hub.city}: ${hub.count} logins, ${hub.suspiciousCount} flagged`,
  }));
}

export function buildAdminLayers(input: {
  markers: ThreatMapMarker[];
  travelArcs: IntelArc[];
  sharedArcs: IntelArc[];
  hubs: CityHub[];
  selectedId: string | null;
  zoom: number;
  time: number;
  onSelectSession: (id: string) => void;
}): Layer[] {
  const { markers, travelArcs, sharedArcs, hubs, selectedId, zoom, time, onSelectSession } = input;
  const wave = pulseWave(time, 1.6);
  const sessionPoints = threatMarkersToPoints(markers, selectedId, zoom);
  const hubPoints = cityHubsToPoints(hubs, selectedId);
  const pulseSessions = sessionPoints.filter((p) => p.tone === "fraud" || p.tone === "attention" || p.id === selectedId);

  const heatData = markers.map((m) => ({
    position: [m.longitude, m.latitude] as [number, number],
    weight: m.riskColor === "red" ? 3 : m.riskColor === "amber" ? 1.5 : 0.4,
  }));

  const impossibleTrips = travelArcs
    .filter((a) => a.tone === "impossible")
    .map((a) => buildTripFromArc(a, 5))
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const tripLoop = time % 5;

  return [
    new HeatmapLayer({
      id: "admin-heatmap",
      data: heatData,
      getPosition: (d: { position: [number, number] }) => d.position,
      getWeight: (d: { weight: number }) => d.weight,
      radiusPixels: 42,
      intensity: 1.15,
      threshold: 0.05,
      colorRange: [
        [14, 165, 233, 0],
        [56, 189, 248, 80],
        [245, 158, 11, 140],
        [239, 68, 68, 200],
        [220, 38, 38, 230],
      ],
      pickable: false,
    }),

    new ArcLayer<IntelArc>({
      id: "admin-shared-arcs",
      data: sharedArcs,
      getSourcePosition: (d) => [d.from.longitude, d.from.latitude],
      getTargetPosition: (d) => [d.to.longitude, d.to.latitude],
      getSourceColor: () => [168, 85, 247, 160],
      getTargetColor: () => [192, 132, 252, 200],
      getWidth: 2,
      greatCircle: true,
      pickable: false,
    }),

    new ArcLayer<IntelArc>({
      id: "admin-travel-arcs",
      data: travelArcs,
      getSourcePosition: (d) => [d.from.longitude, d.from.latitude],
      getTargetPosition: (d) => [d.to.longitude, d.to.latitude],
      getSourceColor: (d) => {
        const selected = selectedId !== null && (d.fromSessionId === selectedId || d.toSessionId === selectedId);
        const dimmed = selectedId !== null && !selected;
        return hexToRgba(PATH_TONE_COLORS[d.tone], dimmed ? 50 : d.tone === "impossible" ? 230 : 170);
      },
      getTargetColor: (d) => {
        const selected = selectedId !== null && (d.fromSessionId === selectedId || d.toSessionId === selectedId);
        const dimmed = selectedId !== null && !selected;
        return hexToRgba(PATH_TONE_COLORS[d.tone], dimmed ? 40 : d.tone === "impossible" ? 255 : 150);
      },
      getWidth: (d) => {
        const selected = selectedId !== null && (d.fromSessionId === selectedId || d.toSessionId === selectedId);
        if (d.tone === "impossible") return selected ? 6 : 4;
        return selected ? 3 : 1.8;
      },
      greatCircle: true,
      pickable: false,
    }),

    new TripsLayer({
      id: "admin-attack-trips",
      data: impossibleTrips,
      getPath: (d: { path: [number, number][] }) => d.path,
      getTimestamps: (d: { timestamps: number[] }) => d.timestamps,
      getColor: () => [248, 113, 113, 255],
      opacity: 0.9,
      widthMinPixels: 3,
      rounded: true,
      trailLength: 1.2,
      currentTime: tripLoop,
      shadowEnabled: false,
      updateTriggers: { currentTime: tripLoop },
    }),

    new ScatterplotLayer<ScatterPoint>({
      id: "admin-hub-glow",
      data: hubPoints,
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusPx * 2.2,
      radiusUnits: "pixels",
      getFillColor: (d) => toneColor(d.tone, 40),
      stroked: false,
      pickable: false,
    }),

    new ScatterplotLayer<ScatterPoint>({
      id: "admin-hubs",
      data: hubPoints,
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusPx,
      radiusUnits: "pixels",
      getFillColor: (d) => toneColor(d.tone, 210),
      getLineColor: [255, 255, 255, 180],
      getLineWidth: 1.5,
      lineWidthUnits: "pixels",
      stroked: true,
      pickable: true,
      onClick: (info: PickingInfo<ScatterPoint>) => {
        // Selecting a hub zooms story via first matching session — handled by parent if needed.
        // Prefer no-op; city hubs are visual context.
        void info;
      },
    }),

    new TextLayer<ScatterPoint>({
      id: "admin-hub-labels",
      data: hubPoints.filter((h) => (h.count ?? 0) >= 2 || h.tone === "fraud"),
      getPosition: (d) => d.position,
      getText: (d) => `${(d.cityLabel ?? "City").slice(0, 10)} · ${d.count ?? 0}`,
      getSize: 11,
      getColor: [226, 232, 240, 255],
      getTextAnchor: "middle",
      getAlignmentBaseline: "top",
      getPixelOffset: [0, 14],
      fontWeight: 600,
      pickable: false,
    }),

    new ScatterplotLayer<ScatterPoint>({
      id: "admin-session-pulse",
      data: pulseSessions,
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusPx * (1.8 + wave * 2),
      radiusUnits: "pixels",
      getFillColor: (d) => toneColor(d.tone, Math.round(80 * (1 - wave))),
      stroked: false,
      pickable: false,
      updateTriggers: { getRadius: time, getFillColor: time },
    }),

    new ScatterplotLayer<ScatterPoint>({
      id: "admin-sessions",
      data: sessionPoints,
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusPx,
      radiusUnits: "pixels",
      getFillColor: (d) => toneColor(d.tone, 255),
      getLineColor: (d) => (d.id === selectedId ? [255, 255, 255, 255] : [255, 255, 255, 160]),
      getLineWidth: (d) => (d.id === selectedId ? 3 : 1.25),
      lineWidthUnits: "pixels",
      stroked: true,
      pickable: true,
      autoHighlight: true,
      onClick: (info: PickingInfo<ScatterPoint>) => {
        if (info.object?.kind === "point") onSelectSession(info.object.id);
      },
    }),

    new ScatterplotLayer<ScatterPoint>({
      id: "admin-selected-ring",
      data: sessionPoints.filter((p) => p.id === selectedId),
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusPx * (2.4 + wave),
      radiusUnits: "pixels",
      getFillColor: [0, 0, 0, 0],
      getLineColor: (d) => toneColor(d.tone, Math.round(220 - wave * 100)),
      getLineWidth: 3,
      lineWidthUnits: "pixels",
      stroked: true,
      filled: false,
      pickable: false,
      updateTriggers: { getRadius: time, getLineColor: time },
    }),

    new TextLayer<ScatterPoint>({
      id: "admin-incident-ids",
      data: sessionPoints.filter((p) => p.incidentId && (p.id === selectedId || p.tone === "fraud" || p.tone === "attention")),
      getPosition: (d) => d.position,
      getText: (d) => d.incidentId ?? "",
      getSize: 11,
      getColor: [248, 250, 252, 255],
      getTextAnchor: "middle",
      getAlignmentBaseline: "bottom",
      getPixelOffset: [0, -12],
      fontWeight: 700,
      fontFamily: "Geist, Inter, system-ui, sans-serif",
      pickable: false,
    }),
  ];
}
