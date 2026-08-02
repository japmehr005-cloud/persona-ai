"use client";

import { useCallback, useEffect, useState, type ReactNode, type RefObject } from "react";
import { Map as MapLibreMap, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import type { Map as MapLibreGLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  INDIA_DEFAULT_VIEW,
  MAP_STYLE_CANDIDATES,
  SECURITY_CANVAS_HIDE_PATTERNS,
  SECURITY_CANVAS_KEEP_LAYER_IDS,
  SECURITY_CANVAS_PAINT_OVERRIDES,
} from "@/lib/map-style";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

async function resolveWorkingStyleUrl(): Promise<string | null> {
  for (const candidate of MAP_STYLE_CANDIDATES) {
    try {
      // Prefer a fresh style document so geographic-layer fixes are not masked
      // by a force-cached blank/broken JSON from an earlier iteration.
      const response = await fetch(candidate, { method: "GET", cache: "no-cache" });
      if (!response.ok) continue;
      const body = await response.clone().text();
      const parsed = JSON.parse(body) as { layers?: unknown[]; sources?: Record<string, unknown> };
      if (!parsed.layers?.length || !parsed.sources) continue;
      return candidate;
    } catch {
      // Try the next candidate — a single CDN outage must not blank FIN.
    }
  }
  return null;
}

function isProtectedGeographicLayer(layerId: string, sourceLayer: string): boolean {
  if (SECURITY_CANVAS_KEEP_LAYER_IDS.some((pattern) => pattern.test(layerId))) return true;
  return /^(water|boundary|landcover)$/i.test(sourceLayer);
}

function stripNonCanvasLayers(map: MapLibreGLMap) {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    const sourceLayer = "source-layer" in layer ? String(layer["source-layer"] ?? "") : "";

    if (!isProtectedGeographicLayer(layer.id, sourceLayer)) {
      const shouldHide = SECURITY_CANVAS_HIDE_PATTERNS.some(
        (pattern) => pattern.test(layer.id) || pattern.test(sourceLayer)
      );
      if (shouldHide) {
        try {
          map.setLayoutProperty(layer.id, "visibility", "none");
        } catch {
          // Layer may already be absent from a stripped style.
        }
      }
    }

    for (const override of SECURITY_CANVAS_PAINT_OVERRIDES) {
      if (!override.match.test(layer.id)) continue;
      for (const [key, value] of Object.entries(override.paint)) {
        try {
          // Paint keys are validated at runtime against the layer type.
          map.setPaintProperty(layer.id, key as never, value as never);
        } catch {
          // Property may not apply to this layer type.
        }
      }
    }
  }
}

export interface FinMapShellProps {
  mapRef?: RefObject<MapRef | null>;
  initialViewState?: { longitude: number; latitude: number; zoom: number };
  interactiveLayerIds?: string[];
  onClick?: (event: Parameters<NonNullable<React.ComponentProps<typeof MapLibreMap>["onClick"]>>[0]) => void;
  onMouseMove?: (event: Parameters<NonNullable<React.ComponentProps<typeof MapLibreMap>["onMouseMove"]>>[0]) => void;
  onMove?: (event: Parameters<NonNullable<React.ComponentProps<typeof MapLibreMap>["onMove"]>>[0]) => void;
  onMoveEnd?: (event: Parameters<NonNullable<React.ComponentProps<typeof MapLibreMap>["onMoveEnd"]>>[0]) => void;
  onLoad?: (event: Parameters<NonNullable<React.ComponentProps<typeof MapLibreMap>["onLoad"]>>[0]) => void;
  cursor?: string;
  className?: string;
  children?: ReactNode;
  /** Absolute-positioned overlay above the MapLibre canvas (legacy; prefer children + DeckOverlay). */
  overlay?: ReactNode;
  legend?: ReactNode;
}

/**
 * Shared MapLibre host for every FIN surface. Resolves the stripped security
 * canvas style first, falls back to remote OpenFreeMap dark styles, and
 * force-hides road/label layers so the canvas never looks like Google Maps.
 */
export function FinMapShell({
  mapRef,
  initialViewState = INDIA_DEFAULT_VIEW,
  interactiveLayerIds,
  onClick,
  onMouseMove,
  onMove,
  onMoveEnd,
  onLoad,
  cursor,
  className,
  children,
  overlay,
  legend,
}: FinMapShellProps) {
  const [mapStyle, setMapStyle] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveWorkingStyleUrl().then((url) => {
      if (cancelled) return;
      if (url) setMapStyle(url);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoad = useCallback(
    (event: Parameters<NonNullable<React.ComponentProps<typeof MapLibreMap>["onLoad"]>>[0]) => {
      // Never let style post-processing block mapReady / overlay attach.
      try {
        stripNonCanvasLayers(event.target);
      } catch (error) {
        console.error("[FIN-MAP-PIPELINE] stripNonCanvasLayers failed", error);
      }
      onLoad?.(event);
    },
    [onLoad]
  );

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-xl border border-border/60 bg-[#0a1428]", className)}>
      {failed ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="size-8 text-warning" />
          <div>
            <p className="text-sm font-medium text-foreground">Map basemap unavailable</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Every map style endpoint failed to load. Login intelligence is still recorded and visible in the timeline.
            </p>
          </div>
        </div>
      ) : !mapStyle ? (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading security canvas…
          <Skeleton className="absolute inset-0 -z-10 bg-[#0a1428]" />
        </div>
      ) : (
        <MapLibreMap
          ref={mapRef}
          mapStyle={mapStyle}
          initialViewState={initialViewState}
          style={{ width: "100%", height: "100%", background: "#0a1428" }}
          attributionControl={{ compact: true }}
          cooperativeGestures={false}
          interactiveLayerIds={interactiveLayerIds}
          onClick={onClick}
          onMouseMove={onMouseMove}
          onMove={onMove}
          onMoveEnd={onMoveEnd}
          onLoad={handleLoad}
          cursor={cursor}
          dragRotate={false}
          pitchWithRotate={false}
        >
          <NavigationControl position="bottom-right" showCompass={false} visualizePitch={false} />
          {children}
        </MapLibreMap>
      )}

      {/* Atmospheric depth — vignette + soft radial wash + film grain */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        aria-hidden
        style={{
          background: [
            "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(56,189,248,0.04) 0%, transparent 55%)",
            "radial-gradient(ellipse at center, transparent 35%, rgba(3,7,18,0.55) 100%)",
          ].join(", "),
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.035] mix-blend-overlay"
        aria-hidden
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Only mount overlays once the MapLibre instance exists. */}
      {mapStyle && !failed ? overlay : null}

      {legend && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-[#0a1428]/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
          {legend}
        </div>
      )}
    </div>
  );
}
