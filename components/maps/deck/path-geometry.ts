import { greatCircle } from "@turf/great-circle";
import { point } from "@turf/helpers";

import type { SecurityMapPathTone } from "@/services/fin/geo-intelligence";

export interface ArcEndpoint {
  longitude: number;
  latitude: number;
}

export interface IntelArc {
  id: string;
  fromSessionId: string;
  toSessionId: string;
  from: ArcEndpoint;
  to: ArcEndpoint;
  tone: SecurityMapPathTone;
  /** Shared-device link vs travel path. */
  kind: "travel" | "shared-device";
}

export interface TripPath {
  id: string;
  path: [number, number][];
  timestamps: number[];
  tone: SecurityMapPathTone;
}

/** Great-circle waypoints [lng, lat] for ArcLayer / TripsLayer. */
export function buildGreatCircleWaypoints(
  from: ArcEndpoint,
  to: ArcEndpoint,
  npoints = 48
): [number, number][] {
  try {
    const arc = greatCircle(point([from.longitude, from.latitude]), point([to.longitude, to.latitude]), {
      npoints,
    });
    if (arc.geometry.type !== "LineString") return [];
    return arc.geometry.coordinates.map(([lng, lat]) => [lng, lat] as [number, number]);
  } catch {
    return [
      [from.longitude, from.latitude],
      [to.longitude, to.latitude],
    ];
  }
}

/** Build TripsLayer data with evenly spaced timestamps for looping animation. */
export function buildTripFromArc(arc: IntelArc, durationSec = 4): TripPath | null {
  const path = buildGreatCircleWaypoints(arc.from, arc.to, 64);
  if (path.length < 2) return null;
  const timestamps = path.map((_, index) => (index / (path.length - 1)) * durationSec);
  return { id: arc.id, path, timestamps, tone: arc.tone };
}

export function hexToRgba(hex: string, alpha = 255): [number, number, number, number] {
  const cleaned = hex.replace("#", "");
  const value = Number.parseInt(cleaned.length === 3 ? cleaned.split("").map((c) => c + c).join("") : cleaned, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

export const PATH_TONE_COLORS: Record<SecurityMapPathTone, string> = {
  impossible: "#ef4444",
  normal: "#38bdf8",
  trusted: "#64748b",
};
