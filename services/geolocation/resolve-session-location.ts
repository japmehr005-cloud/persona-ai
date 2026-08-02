import type { SessionLocationSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ipGeolocationProvider, type GeolocationResult } from "@/services/geolocation/ip-geolocation";
import { reverseGeocodeProvider } from "@/services/geolocation/reverse-geocode";

const AUTO_TRUST_USE_COUNT = 3;

export interface BrowserLocationInput {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

export interface ResolvedSessionLocation extends GeolocationResult {
  accuracy: number | null;
  locationSource: SessionLocationSource;
  trusted: boolean;
  isNewLocation: boolean;
}

/**
 * Resolves a session's location, preferring precise browser geolocation
 * (with reverse-geocoded city/region/country) and falling back to IP
 * geolocation when permission is denied or coordinates are unavailable.
 * Never throws — authentication must not fail because of location.
 */
export async function resolveSessionLocation(
  userId: string,
  ipAddress: string | null,
  browserLocation?: BrowserLocationInput | null
): Promise<ResolvedSessionLocation> {
  let location: GeolocationResult;
  let accuracy: number | null = null;
  let locationSource: SessionLocationSource = "UNKNOWN";

  if (
    browserLocation &&
    Number.isFinite(browserLocation.latitude) &&
    Number.isFinite(browserLocation.longitude) &&
    Math.abs(browserLocation.latitude) <= 90 &&
    Math.abs(browserLocation.longitude) <= 180
  ) {
    const place = await reverseGeocodeProvider.reverse(browserLocation.latitude, browserLocation.longitude);
    location = {
      latitude: browserLocation.latitude,
      longitude: browserLocation.longitude,
      city: place.city,
      region: place.region,
      country: place.country,
    };
    accuracy = typeof browserLocation.accuracy === "number" ? browserLocation.accuracy : null;
    locationSource = "BROWSER";
  } else {
    location = await ipGeolocationProvider.lookup(ipAddress);
    locationSource = location.latitude !== null ? "IP" : "UNKNOWN";
  }

  if (!location.city && !location.country) {
    return { ...location, accuracy, locationSource, trusted: false, isNewLocation: false };
  }

  const existing = await prisma.trustedLocation.findFirst({
    where: { userId, city: location.city, country: location.country },
  });

  if (existing) {
    const updated = await prisma.trustedLocation.update({
      where: { id: existing.id },
      data: {
        useCount: { increment: 1 },
        lastSeenAt: new Date(),
        trusted: existing.trusted || existing.useCount + 1 >= AUTO_TRUST_USE_COUNT,
        latitude: location.latitude ?? existing.latitude,
        longitude: location.longitude ?? existing.longitude,
        region: location.region ?? existing.region,
      },
    });
    return { ...location, accuracy, locationSource, trusted: updated.trusted, isNewLocation: false };
  }

  await prisma.trustedLocation.create({
    data: {
      userId,
      city: location.city,
      region: location.region,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
      source: "AUTO_LEARNED",
      trusted: false,
      useCount: 1,
    },
  });

  return { ...location, accuracy, locationSource, trusted: false, isNewLocation: true };
}

export interface TrustedLocationView {
  id: string;
  city: string | null;
  region: string | null;
  country: string | null;
  trusted: boolean;
  source: "SELF_REPORTED" | "AUTO_LEARNED";
  useCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export async function getTrustedLocationsForUser(userId: string): Promise<TrustedLocationView[]> {
  const locations = await prisma.trustedLocation.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
  });

  return locations.map((location) => ({
    id: location.id,
    city: location.city,
    region: location.region,
    country: location.country,
    trusted: location.trusted,
    source: location.source,
    useCount: location.useCount,
    firstSeenAt: location.firstSeenAt,
    lastSeenAt: location.lastSeenAt,
  }));
}

export async function markLocationTrusted(userId: string, locationId: string): Promise<boolean> {
  const result = await prisma.trustedLocation.updateMany({
    where: { id: locationId, userId },
    data: { trusted: true, source: "SELF_REPORTED" },
  });
  return result.count > 0;
}
