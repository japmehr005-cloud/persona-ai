import { createHash } from "crypto";

export interface GeolocationResult {
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Abstraction over IP → location lookups. Production path tries a keyless
 * public API first, then falls back to the deterministic mock so local /
 * private IPs and API outages never blank the Security Map.
 */
export interface IpGeolocationProvider {
  lookup(ipAddress: string | null): Promise<GeolocationResult>;
}

const UNKNOWN_LOCATION: GeolocationResult = {
  city: null,
  region: null,
  country: null,
  latitude: null,
  longitude: null,
};

// Deterministic pool used for private/local IPs and as a last-resort
// fallback when every remote lookup fails — keeps demos reproducible.
const CITY_POOL: GeolocationResult[] = [
  { city: "Chandigarh", region: "Punjab", country: "India", latitude: 30.7333, longitude: 76.7794 },
  { city: "Mumbai", region: "Maharashtra", country: "India", latitude: 19.076, longitude: 72.8777 },
  { city: "New Delhi", region: "Delhi", country: "India", latitude: 28.7041, longitude: 77.1025 },
  { city: "Bengaluru", region: "Karnataka", country: "India", latitude: 12.9716, longitude: 77.5946 },
  { city: "Pune", region: "Maharashtra", country: "India", latitude: 18.5204, longitude: 73.8567 },
  { city: "Amritsar", region: "Punjab", country: "India", latitude: 31.634, longitude: 74.8723 },
  { city: "Dubai", region: "Dubai", country: "United Arab Emirates", latitude: 25.2048, longitude: 55.2708 },
  { city: "Singapore", region: "Singapore", country: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { city: "London", region: "England", country: "United Kingdom", latitude: 51.5072, longitude: -0.1276 },
];

const HOME_LOCATION = CITY_POOL[0];

function isPrivateOrLocalIp(ip: string): boolean {
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.2") ||
    ip.startsWith("172.3") ||
    ip === "0.0.0.0" ||
    ip.startsWith("::ffff:127.") ||
    ip.startsWith("::ffff:10.") ||
    ip.startsWith("::ffff:192.168.")
  );
}

function hashToIndex(value: string, modulo: number): number {
  const digest = createHash("sha256").update(value).digest();
  return digest.readUInt32BE(0) % modulo;
}

export class MockIpGeolocationProvider implements IpGeolocationProvider {
  async lookup(ipAddress: string | null): Promise<GeolocationResult> {
    if (!ipAddress) return UNKNOWN_LOCATION;
    if (isPrivateOrLocalIp(ipAddress)) return HOME_LOCATION;
    return CITY_POOL[hashToIndex(ipAddress, CITY_POOL.length)];
  }
}

/**
 * Keyless IP lookup via ipwho.is. Used only for public client IPs — private
 * addresses never leave the host (they resolve via the mock home city so
 * local demos still get a plausible pin).
 */
class IpWhoIsGeolocationProvider implements IpGeolocationProvider {
  async lookup(ipAddress: string | null): Promise<GeolocationResult> {
    if (!ipAddress || isPrivateOrLocalIp(ipAddress)) return UNKNOWN_LOCATION;

    try {
      const response = await fetch(`https://ipwho.is/${encodeURIComponent(ipAddress)}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3500),
        next: { revalidate: 60 * 60 },
      });
      if (!response.ok) return UNKNOWN_LOCATION;

      const payload = (await response.json()) as {
        success?: boolean;
        city?: string;
        region?: string;
        country?: string;
        latitude?: number;
        longitude?: number;
      };

      if (!payload.success) return UNKNOWN_LOCATION;
      if (typeof payload.latitude !== "number" || typeof payload.longitude !== "number") {
        return UNKNOWN_LOCATION;
      }

      return {
        city: payload.city ?? null,
        region: payload.region ?? null,
        country: payload.country ?? null,
        latitude: payload.latitude,
        longitude: payload.longitude,
      };
    } catch (error) {
      console.error("[geolocation] IP lookup failed", error);
      return UNKNOWN_LOCATION;
    }
  }
}

class HybridIpGeolocationProvider implements IpGeolocationProvider {
  private readonly remote = new IpWhoIsGeolocationProvider();
  private readonly mock = new MockIpGeolocationProvider();

  async lookup(ipAddress: string | null): Promise<GeolocationResult> {
    if (!ipAddress) return UNKNOWN_LOCATION;
    if (isPrivateOrLocalIp(ipAddress)) return this.mock.lookup(ipAddress);

    const remote = await this.remote.lookup(ipAddress);
    if (remote.latitude !== null && remote.longitude !== null) return remote;
    return this.mock.lookup(ipAddress);
  }
}

export const ipGeolocationProvider: IpGeolocationProvider = new HybridIpGeolocationProvider();
