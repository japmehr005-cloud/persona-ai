import { prisma } from "@/lib/prisma";

export interface DeviceIntelligenceView {
  id: string;
  label: string;
  ownerName: string;
  trusted: boolean;
  fingerprintHash: string;
  similarityKey: string | null;
  similarUserCount: number;
  fraudReportCount: number;
  openFraudReportCount: number;
  lastSeenAt: Date;
  firstSeenAt: Date;
  userAgent: string | null;
  platform: string | null;
  timezone: string | null;
  language: string | null;
  screenResolution: string | null;
  hardwareConcurrency: number | null;
  colorDepth: number | null;
  components: Record<string, unknown> | null;
  /** 0–100, display-only (never persisted) — combines the explicit
   * `trusted` flag with two FIN signals: how many *open/confirmed* fraud
   * reports name this device, and how many other customers' devices share
   * its coarse similarity fingerprint (the strongest cross-account
   * fraud-ring signal available without a filed report). */
  trustScore: number;
}

const DEVICE_INTELLIGENCE_LIMIT = 100;

function computeTrustScore(input: { trusted: boolean; openFraudReportCount: number; similarUserCount: number }): number {
  let score = input.trusted ? 85 : 55;
  score -= Math.min(input.openFraudReportCount * 25, 75);
  score -= Math.min(input.similarUserCount * 12, 36);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * The Admin SOC's Device Intelligence feed: every device ranked by how
 * suspicious it looks — untrusted first, then by how many *other* users
 * share its coarse `similarityKey` (the strongest cross-account fraud-ring
 * signal FIN has) and how many fraud reports name it directly. Also
 * surfaces the raw `components` fingerprint snapshot and a display-only
 * trust score for the device detail view.
 */
export async function getDeviceIntelligence(): Promise<DeviceIntelligenceView[]> {
  const devices = await prisma.device.findMany({
    orderBy: [{ trusted: "asc" }, { lastSeenAt: "desc" }],
    take: DEVICE_INTELLIGENCE_LIMIT,
    include: {
      user: { select: { firstName: true, lastName: true } },
      fraudReports: { select: { id: true, status: true } },
    },
  });

  const similarityKeys = devices.map((device) => device.similarityKey).filter((key): key is string => Boolean(key));

  const similarityCounts = new Map<string, number>();
  if (similarityKeys.length > 0) {
    const matches = await prisma.device.groupBy({
      by: ["similarityKey", "userId"],
      where: { similarityKey: { in: similarityKeys } },
    });
    for (const match of matches) {
      if (!match.similarityKey) continue;
      similarityCounts.set(match.similarityKey, (similarityCounts.get(match.similarityKey) ?? 0) + 1);
    }
  }

  return devices.map((device) => {
    const similarUserCount = device.similarityKey ? Math.max(0, (similarityCounts.get(device.similarityKey) ?? 1) - 1) : 0;
    const openFraudReportCount = device.fraudReports.filter(
      (report) => report.status === "OPEN" || report.status === "CONFIRMED"
    ).length;

    return {
      id: device.id,
      label: device.label,
      ownerName: `${device.user.firstName} ${device.user.lastName}`,
      trusted: device.trusted,
      fingerprintHash: device.fingerprintHash,
      similarityKey: device.similarityKey,
      similarUserCount,
      fraudReportCount: device.fraudReports.length,
      openFraudReportCount,
      lastSeenAt: device.lastSeenAt,
      firstSeenAt: device.firstSeenAt,
      userAgent: device.userAgent,
      platform: device.platform,
      timezone: device.timezone,
      language: device.language,
      screenResolution: device.screenResolution,
      hardwareConcurrency: device.hardwareConcurrency,
      colorDepth: device.colorDepth,
      components: (device.components as Record<string, unknown> | null) ?? null,
      trustScore: computeTrustScore({ trusted: device.trusted, openFraudReportCount, similarUserCount }),
    };
  });
}
