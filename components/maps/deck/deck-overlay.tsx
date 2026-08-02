"use client";

import { useControl } from "react-map-gl/maplibre";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import type { Layer } from "@deck.gl/core";

export type DeckOverlayProps = Omit<MapboxOverlayProps, "layers"> & {
  layers: Layer[];
};

/**
 * deck.gl ↔ MapLibre bridge via MapboxOverlay (overlaid WebGL canvas).
 * Must be rendered as a child of react-map-gl Map.
 */
export function DeckOverlay({ layers, ...overlayProps }: DeckOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay({ interleaved: false, ...overlayProps }));
  overlay.setProps({ layers, ...overlayProps });
  return null;
}
