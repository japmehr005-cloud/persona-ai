import type { NextConfig } from "next";

// MapLibre needs cross-origin style/tile fetches + blob workers.
// Reverse geocoding (Nominatim) and optional IP geo providers also need
// outbound connect. Keep the rest of the CSP strict.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://tiles.openfreemap.org",
    "https://*.openfreemap.org",
    "https://nominatim.openstreetmap.org",
    "https://ipapi.co",
    "https://ipwho.is",
  ].join(" "),
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation is required for real login-map coordinates. Restricted to
  // same-origin only — never granted to third-party iframes.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
