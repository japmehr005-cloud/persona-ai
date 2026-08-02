"use client";

import { useEffect } from "react";

import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { captureBrowserGeolocation } from "@/lib/browser-geolocation";
import { registerDeviceAction } from "@/features/security/device-actions";

/**
 * Silently registers the current device/session on every customer page
 * load, capturing browser geolocation when the user grants permission and
 * falling back to IP geolocation server-side when they deny it. Renders
 * nothing — this is a side-effect-only provider mounted once in the
 * customer layout. Failures never block the app or authentication.
 */
export function DeviceFingerprintProvider() {
  useEffect(() => {
    let cancelled = false;

    async function register() {
      try {
        const [fingerprint, browserLocation] = await Promise.all([
          getDeviceFingerprint(),
          captureBrowserGeolocation(),
        ]);
        if (cancelled) return;

        await registerDeviceAction({
          ...fingerprint,
          browserLocation,
        });
      } catch {
        // Fingerprinting / geolocation are best-effort; never block the app.
      }
    }

    void register();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
