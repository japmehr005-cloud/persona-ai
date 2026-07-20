"use client";

import { useEffect } from "react";

import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { registerDeviceAction } from "@/features/security/device-actions";

/**
 * Silently registers the current device/session on every customer page
 * load. Renders nothing — this is a side-effect-only provider mounted once
 * in the customer layout.
 */
export function DeviceFingerprintProvider() {
  useEffect(() => {
    let cancelled = false;

    getDeviceFingerprint()
      .then((fingerprint) => {
        if (!cancelled) return registerDeviceAction(fingerprint);
      })
      .catch(() => {
        // Fingerprinting is best-effort; failures should never block the app.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
