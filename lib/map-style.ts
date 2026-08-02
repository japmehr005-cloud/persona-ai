/**
 * Production MapLibre style catalogue for FIN security canvases.
 *
 * Primary style is a locally hosted OpenFreeMap-derived JSON that keeps only
 * land/water/admin boundaries (no roads, buildings, POIs, or place labels).
 * Remote OpenFreeMap styles remain as fallbacks if the local asset fails.
 *
 * Cache-bust the local style whenever geographic layers change so browsers
 * do not keep a blank/broken force-cached copy.
 */
export const MAP_STYLE_CANDIDATES = [
  "/map-styles/fin-security-canvas.json?v=20260802b",
  "https://tiles.openfreemap.org/styles/dark",
  "https://tiles.openfreemap.org/styles/fiord",
] as const;

export const PRIMARY_MAP_STYLE = MAP_STYLE_CANDIDATES[0];

/**
 * Layers that must remain visible — never hide these even if a hide pattern
 * accidentally matches a substring (e.g. older `/tunnel/` / `/park/` patterns).
 */
export const SECURITY_CANVAS_KEEP_LAYER_IDS = [
  /^background$/i,
  /^natural_earth$/i,
  /^water$/i,
  /^waterway$/i,
  /^coastline$/i,
  /^landcover_/i,
  /^boundary_/i,
] as const;

/**
 * Hide only non-geographic chrome when falling back to a full OpenFreeMap
 * style. Patterns are anchored/specific so they cannot match `water`,
 * `boundary_*`, or `landcover_*`.
 */
export const SECURITY_CANVAS_HIDE_PATTERNS = [
  /^(road_|highway_|railway_|aeroway|building|housenumber)/i,
  /^(transportation|poi|place_|water_name|mountain_peak)/i,
  /^(landuse_|park$|park_)/i,
  /(tunnel_|bridge_|ferry_|airport_|label|_label$)/i,
] as const;

/** After stripping, reinforce NordVPN palette on residual basemap layers. */
export const SECURITY_CANVAS_PAINT_OVERRIDES: Array<{
  match: RegExp;
  paint: Record<string, string | number>;
}> = [
  { match: /^background$/i, paint: { "background-color": "#152033" } },
  { match: /^water$/i, paint: { "fill-color": "#07101f" } },
];

/** India-centered default framing used by both the customer Security Map
 * and the Admin Threat Map when all sessions are inside India (or none exist). */
export const INDIA_DEFAULT_VIEW = {
  longitude: 78.9629,
  latitude: 22.5937,
  zoom: 4.2,
} as const;
