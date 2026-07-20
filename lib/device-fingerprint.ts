const STORAGE_KEY = "securebank-device-anchor";

function getOrCreateDeviceAnchor(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const anchor = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, anchor);
    return anchor;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall back to a
    // session-only anchor so fingerprinting still works for this visit.
    return crypto.randomUUID();
  }
}

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export interface DeviceFingerprint {
  fingerprintHash: string;
  label: string;
  userAgent: string;
}

/**
 * Produces a stable, low-entropy device fingerprint from browser
 * characteristics plus a persisted local anchor. This is a pragmatic
 * substitute for a commercial fingerprinting SDK (e.g. FingerprintJS Pro),
 * suitable for a demo/self-hosted deployment without third-party API keys.
 */
export async function getDeviceFingerprint(): Promise<DeviceFingerprint> {
  const anchor = getOrCreateDeviceAnchor();
  const { userAgent, platform, language } = window.navigator;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown";
  const screenSignature = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;

  const raw = [anchor, userAgent, platform, language, timezone, screenSignature].join("|");
  const fingerprintHash = await sha256(raw);

  return {
    fingerprintHash,
    label: describeDevice(userAgent),
    userAgent,
  };
}

function describeDevice(userAgent: string): string {
  const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
  let browser = "Unknown browser";
  if (userAgent.includes("Edg/")) browser = "Edge";
  else if (userAgent.includes("Chrome/")) browser = "Chrome";
  else if (userAgent.includes("Firefox/")) browser = "Firefox";
  else if (userAgent.includes("Safari/")) browser = "Safari";

  let os = "Unknown OS";
  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac OS")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

  return `${browser} on ${os}${isMobile ? " (mobile)" : ""}`;
}
