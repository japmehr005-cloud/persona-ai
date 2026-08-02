const EARTH_RADIUS_KM = 6371;
// The fastest a legitimate traveler could plausibly move between two logins
// — comfortably above commercial flight speed (~900 km/h) plus airport
// transit slack, so this only fires for genuinely impossible journeys, not
// merely fast ones.
const MAX_PLAUSIBLE_SPEED_KMH = 1000;
// Below this distance, ordinary GPS/IP-geolocation jitter and city-level
// rounding can look like "movement" even from the same physical location —
// ignore it rather than flagging false positives.
const MIN_DISTANCE_KM = 80;
// Guards against divide-by-near-zero producing an absurd (but technically
// correct) speed for two logins seconds apart from a slightly different
// resolved city.
const MIN_ELAPSED_HOURS = 1 / 60;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface ImpossibleTravelInput {
  previous: (GeoPoint & { timestamp: Date }) | null;
  next: GeoPoint & { timestamp: Date };
}

export interface ImpossibleTravelResult {
  isImpossible: boolean;
  distanceKm: number;
  elapsedHours: number;
  impliedSpeedKmh: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/long points (Haversine formula). */
function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Context Intelligence's geo-velocity check — compares a new login's
 * location/timestamp against the customer's immediately preceding session.
 * If the implied travel speed between the two exceeds what's physically
 * possible (accounting for commercial air travel), the new session is
 * flagged as an "impossible travel" anomaly. This is what powers the
 * Delhi → Dubai → London-in-10-minutes scenario on the Security Map's login
 * path visualization.
 */
export function detectImpossibleTravel(input: ImpossibleTravelInput): ImpossibleTravelResult {
  if (!input.previous) {
    return { isImpossible: false, distanceKm: 0, elapsedHours: 0, impliedSpeedKmh: 0 };
  }

  const distanceKm = haversineDistanceKm(input.previous, input.next);
  const elapsedMs = input.next.timestamp.getTime() - input.previous.timestamp.getTime();
  const elapsedHours = Math.max(MIN_ELAPSED_HOURS, elapsedMs / (1000 * 60 * 60));
  const impliedSpeedKmh = distanceKm / elapsedHours;

  const isImpossible = distanceKm >= MIN_DISTANCE_KM && impliedSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH;

  return { isImpossible, distanceKm, elapsedHours, impliedSpeedKmh };
}
