import { prisma } from "@/lib/prisma";

export interface BehavioralSnapshot {
  hasProfile: boolean;
  typicalAmount: number | null;
  txPerDay: number | null;
  trustedDeviceCount: number;
  topActiveHourLabel: string | null;
  updatedAt: Date | null;
}

export async function getBehavioralSnapshot(userId: string): Promise<BehavioralSnapshot> {
  const [profile, trustedDeviceCount] = await Promise.all([
    prisma.behavioralProfile.findUnique({ where: { userId } }),
    prisma.device.count({ where: { userId, trusted: true } }),
  ]);

  if (!profile) {
    return {
      hasProfile: false,
      typicalAmount: null,
      txPerDay: null,
      trustedDeviceCount,
      topActiveHourLabel: null,
      updatedAt: null,
    };
  }

  const activeHours = profile.activeHours as number[] | null;
  let topActiveHourLabel: string | null = null;
  if (Array.isArray(activeHours) && activeHours.length === 24) {
    const topHour = activeHours.reduce(
      (best, value, hour) => (value > activeHours[best] ? hour : best),
      0
    );
    const period = topHour >= 12 ? "PM" : "AM";
    const displayHour = topHour % 12 === 0 ? 12 : topHour % 12;
    topActiveHourLabel = `${displayHour}${period}`;
  }

  return {
    hasProfile: true,
    typicalAmount: Number(profile.avgAmount),
    txPerDay: Number(profile.txPerDay),
    trustedDeviceCount,
    topActiveHourLabel,
    updatedAt: profile.updatedAt,
  };
}
