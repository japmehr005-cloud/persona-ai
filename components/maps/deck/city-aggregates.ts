import type { ThreatMapMarker } from "@/services/fin/geo-intelligence";
import { toneForMarker, type SecurityMarkerTone } from "@/components/maps/marker-tones";

export interface CityHub {
  id: string;
  city: string;
  country: string | null;
  longitude: number;
  latitude: number;
  count: number;
  suspiciousCount: number;
  impossibleCount: number;
  tone: SecurityMarkerTone;
  /** Worst risk among members for coloring. */
  riskWeight: number;
}

const RISK_RANK: Record<SecurityMarkerTone, number> = {
  trusted: 1,
  current: 2,
  attention: 3,
  fraud: 4,
};

/** Aggregate threat markers into city intelligence hubs for the admin map. */
export function buildCityHubs(markers: ThreatMapMarker[]): CityHub[] {
  const groups = new Map<string, ThreatMapMarker[]>();

  for (const marker of markers) {
    const city = marker.city?.trim() || "Unknown";
    const country = marker.country?.trim() || "";
    const key = `${city.toLowerCase()}::${country.toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(marker);
    groups.set(key, list);
  }

  const hubs: CityHub[] = [];
  for (const [key, members] of groups) {
    if (members.length === 0) continue;
    let sumLat = 0;
    let sumLng = 0;
    let suspiciousCount = 0;
    let impossibleCount = 0;
    let worstTone: SecurityMarkerTone = "trusted";

    for (const marker of members) {
      sumLat += marker.latitude;
      sumLng += marker.longitude;
      if (marker.riskColor === "red" || marker.riskColor === "amber") suspiciousCount += 1;
      if (marker.isImpossibleTravel) impossibleCount += 1;
      const tone = toneForMarker(marker);
      if (RISK_RANK[tone] > RISK_RANK[worstTone]) worstTone = tone;
    }

    const city = members[0].city?.trim() || "Unknown";
    hubs.push({
      id: `city:${key}`,
      city,
      country: members[0].country,
      longitude: sumLng / members.length,
      latitude: sumLat / members.length,
      count: members.length,
      suspiciousCount,
      impossibleCount,
      tone: worstTone,
      riskWeight: members.reduce((acc, m) => acc + (m.riskColor === "red" ? 3 : m.riskColor === "amber" ? 1.5 : 1), 0),
    });
  }

  return hubs.sort((a, b) => b.count - a.count);
}

/**
 * Shared-device arcs: sessions of different users that share a deviceId
 * or fingerprintHash — derived client-side from threat markers.
 */
export function buildSharedDeviceLinks(markers: ThreatMapMarker[]): Array<{
  id: string;
  fromSessionId: string;
  toSessionId: string;
  from: { longitude: number; latitude: number };
  to: { longitude: number; latitude: number };
}> {
  const byKey = new Map<string, ThreatMapMarker[]>();

  for (const marker of markers) {
    const key = marker.deviceId
      ? `device:${marker.deviceId}`
      : marker.fingerprintHash
        ? `fp:${marker.fingerprintHash}`
        : null;
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(marker);
    byKey.set(key, list);
  }

  const links: Array<{
    id: string;
    fromSessionId: string;
    toSessionId: string;
    from: { longitude: number; latitude: number };
    to: { longitude: number; latitude: number };
  }> = [];

  for (const [key, members] of byKey) {
    const byUser = new Map<string, ThreatMapMarker>();
    for (const marker of members) {
      const existing = byUser.get(marker.userId);
      if (!existing || marker.occurredAt > existing.occurredAt) {
        byUser.set(marker.userId, marker);
      }
    }
    const reps = [...byUser.values()];
    if (reps.length < 2) continue;

    // Connect first user to each other user (star) — enough to show the ring.
    const hub = reps[0];
    for (let i = 1; i < Math.min(reps.length, 6); i++) {
      const other = reps[i];
      links.push({
        id: `shared:${key}:${hub.id}:${other.id}`,
        fromSessionId: hub.id,
        toSessionId: other.id,
        from: { longitude: hub.longitude, latitude: hub.latitude },
        to: { longitude: other.longitude, latitude: other.latitude },
      });
    }
  }

  return links;
}
