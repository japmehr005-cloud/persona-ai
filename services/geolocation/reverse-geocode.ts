/**
 * Reverse-geocoding abstraction. The default provider uses OpenStreetMap
 * Nominatim (no API key). Swap the export for a commercial provider later
 * without touching register-device or the FIN map layer.
 */

export interface ReverseGeocodeResult {
  city: string | null;
  region: string | null;
  country: string | null;
}

export interface ReverseGeocodeProvider {
  reverse(latitude: number, longitude: number): Promise<ReverseGeocodeResult>;
}

const UNKNOWN: ReverseGeocodeResult = { city: null, region: null, country: null };

class NominatimReverseGeocodeProvider implements ReverseGeocodeProvider {
  async reverse(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return UNKNOWN;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return UNKNOWN;

    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("lat", String(latitude));
      url.searchParams.set("lon", String(longitude));
      url.searchParams.set("zoom", "10");
      url.searchParams.set("addressdetails", "1");

      const response = await fetch(url.toString(), {
        headers: {
          // Nominatim usage policy requires a descriptive User-Agent.
          "User-Agent": "PersonaAI-FIN/1.0 (hackathon; contact: security@securebank.ai)",
          Accept: "application/json",
        },
        // Reverse geocode must never stall login registration.
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });

      if (!response.ok) return UNKNOWN;

      const payload = (await response.json()) as {
        address?: {
          city?: string;
          town?: string;
          village?: string;
          municipality?: string;
          county?: string;
          state?: string;
          region?: string;
          state_district?: string;
          country?: string;
        };
      };

      const address = payload.address;
      if (!address) return UNKNOWN;

      return {
        city: address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? null,
        region: address.state ?? address.region ?? address.state_district ?? null,
        country: address.country ?? null,
      };
    } catch (error) {
      console.error("[geolocation] Reverse geocode failed", error);
      return UNKNOWN;
    }
  }
}

export const reverseGeocodeProvider: ReverseGeocodeProvider = new NominatimReverseGeocodeProvider();
