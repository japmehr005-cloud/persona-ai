import { prisma } from "@/lib/prisma";

const SESSION_REUSE_WINDOW_MINUTES = 30;

export interface RegisterDeviceInput {
  userId: string;
  fingerprintHash: string;
  label: string;
  userAgent: string;
  ipAddress: string | null;
}

/**
 * Registers (or touches) a device and its associated session on page load.
 * The first device ever seen for a user is auto-trusted, since it is
 * presumed to be the device they signed up / logged in from. Every
 * subsequent new fingerprint starts untrusted until the customer confirms
 * it from the Devices & Sessions page — this untrusted state is one of the
 * signals the Adaptive Risk Engine reads in Phase 4.
 */
export async function registerDevice(input: RegisterDeviceInput) {
  const existingDeviceCount = await prisma.device.count({ where: { userId: input.userId } });

  const device = await prisma.device.upsert({
    where: {
      userId_fingerprintHash: { userId: input.userId, fingerprintHash: input.fingerprintHash },
    },
    update: { lastSeenAt: new Date(), label: input.label, userAgent: input.userAgent },
    create: {
      userId: input.userId,
      fingerprintHash: input.fingerprintHash,
      label: input.label,
      userAgent: input.userAgent,
      trusted: existingDeviceCount === 0,
    },
  });

  const reuseWindowStart = new Date(Date.now() - SESSION_REUSE_WINDOW_MINUTES * 60 * 1000);
  const recentSession = await prisma.session.findFirst({
    where: { userId: input.userId, deviceId: device.id, lastActiveAt: { gte: reuseWindowStart } },
    orderBy: { lastActiveAt: "desc" },
  });

  if (recentSession) {
    await prisma.session.update({
      where: { id: recentSession.id },
      data: { lastActiveAt: new Date() },
    });
  } else {
    await prisma.session.create({
      data: {
        userId: input.userId,
        deviceId: device.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  return device;
}
