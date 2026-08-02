import { INDIA_DEFAULT_VIEW } from "@/lib/map-style";

/** Approximate India bounding box used to decide whether the camera should
 * stay India-focused or expand to fit international login sessions. */
export const INDIA_BOUNDS = {
  west: 68.1,
  south: 6.5,
  east: 97.4,
  north: 35.7,
} as const;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export function isInsideIndia(point: GeoPoint): boolean {
  return (
    point.longitude >= INDIA_BOUNDS.west &&
    point.longitude <= INDIA_BOUNDS.east &&
    point.latitude >= INDIA_BOUNDS.south &&
    point.latitude <= INDIA_BOUNDS.north
  );
}

export interface ResolvedViewport {
  longitude: number;
  latitude: number;
  zoom: number;
  /** When set, the map should `fitBounds` after load instead of using zoom. */
  fitBounds?: [[number, number], [number, number]];
}

/**
 * India-first camera: default to the India framing for local/demo relevance.
 * Only widen to a worldwide fitBounds when at least one marker is outside India.
 */
export function resolveInitialView(markers: GeoPoint[]): ResolvedViewport {
  if (markers.length === 0) return { ...INDIA_DEFAULT_VIEW };

  const outside = markers.some((marker) => !isInsideIndia(marker));
  if (!outside) return { ...INDIA_DEFAULT_VIEW };

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const marker of markers) {
    minLng = Math.min(minLng, marker.longitude);
    minLat = Math.min(minLat, marker.latitude);
    maxLng = Math.max(maxLng, marker.longitude);
    maxLat = Math.max(maxLat, marker.latitude);
  }

  const pad = 4;
  return {
    longitude: (minLng + maxLng) / 2,
    latitude: (minLat + maxLat) / 2,
    zoom: 2.8,
    fitBounds: [
      [minLng - pad, minLat - pad],
      [maxLng + pad, maxLat + pad],
    ],
  };
}
