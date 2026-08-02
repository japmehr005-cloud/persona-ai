/**
 * Client-only browser geolocation capture. Never throws — permission denial
 * and unsupported browsers both resolve to `null` so login registration can
 * fall back to IP geolocation without blocking authentication.
 */

export interface BrowserGeolocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

const GEO_TIMEOUT_MS = 8000;
const GEO_MAX_AGE_MS = 60_000;

export function captureBrowserGeolocation(): Promise<BrowserGeolocation | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), GEO_TIMEOUT_MS + 500);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: GEO_MAX_AGE_MS,
      }
    );
  });
}
