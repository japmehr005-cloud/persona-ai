import { prisma } from "@/lib/prisma";

export interface DeviceView {
  id: string;
  label: string;
  trusted: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface SessionView {
  id: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  startedAt: Date;
  lastActiveAt: Date;
}

export async function getDevicesAndSessions(
  userId: string
): Promise<{ devices: DeviceView[]; sessions: SessionView[] }> {
  const [devices, sessions] = await Promise.all([
    prisma.device.findMany({ where: { userId }, orderBy: { lastSeenAt: "desc" } }),
    prisma.session.findMany({
      where: { userId },
      orderBy: { lastActiveAt: "desc" },
      take: 10,
      include: { device: { select: { label: true } } },
    }),
  ]);

  return {
    devices: devices.map((device) => ({
      id: device.id,
      label: device.label,
      trusted: device.trusted,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      deviceLabel: session.device?.label ?? null,
      ipAddress: session.ipAddress,
      startedAt: session.startedAt,
      lastActiveAt: session.lastActiveAt,
    })),
  };
}
