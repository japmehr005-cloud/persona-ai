/**
 * Stable, presentation-only incident codes for Admin SOC surfaces.
 * Same session id always maps to the same INC-xxx — no schema change.
 */
export function toIncidentId(sessionId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < sessionId.length; i += 1) {
    hash ^= sessionId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const n = (hash >>> 0) % 900;
  return `INC-${String(101 + n).padStart(3, "0")}`;
}
