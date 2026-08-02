"use client";

import { useMemo } from "react";
import Supercluster from "supercluster";
import type { BBox, Feature, Point } from "geojson";

export interface ClusterPointProperties {
  id: string;
  [key: string]: unknown;
}

export type ClusterFeature = Feature<
  Point,
  ClusterPointProperties & { cluster?: boolean; point_count?: number; cluster_id?: number }
>;

/** Worldwide fallback so markers still render before the first MapLibre bounds sync. */
const WORLD_BOUNDS: BBox = [-180, -85, 180, 85];

export function useSupercluster(
  points: Feature<Point, ClusterPointProperties>[],
  options: {
    bounds: BBox | null;
    zoom: number;
    radius?: number;
    maxZoom?: number;
  }
) {
  const index = useMemo(() => {
    const cluster = new Supercluster<ClusterPointProperties>({
      radius: options.radius ?? 56,
      maxZoom: options.maxZoom ?? 16,
    });
    cluster.load(points);
    return cluster;
  }, [points, options.radius, options.maxZoom]);

  const clusters = useMemo(() => {
    // Never gate the entire overlay on bounds being non-null — that left the
    // Security Map with zero markers until (and unless) onLoad synced viewport.
    const bbox = options.bounds ?? WORLD_BOUNDS;
    const zoom = Number.isFinite(options.zoom) ? Math.max(0, Math.round(options.zoom)) : 0;
    return index.getClusters(bbox, zoom) as ClusterFeature[];
  }, [index, options.bounds, options.zoom]);

  return { clusters, index };
}
