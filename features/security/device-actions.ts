"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { registerDevice } from "@/services/security/register-device";

const registerDeviceSchema = z.object({
  fingerprintHash: z.string().min(1),
  label: z.string().min(1),
  userAgent: z.string().min(1),
});

export async function registerDeviceAction(input: z.infer<typeof registerDeviceSchema>) {
  const user = await requireUser();
  const parsed = registerDeviceSchema.safeParse(input);
  if (!parsed.success) return;

  const requestHeaders = await headers();
  const ipAddress =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    null;

  await registerDevice({ userId: user.id, ...parsed.data, ipAddress });
}

export async function revokeDeviceAction(deviceId: string) {
  const user = await requireUser();

  await prisma.device.deleteMany({ where: { id: deviceId, userId: user.id } });
  revalidatePath("/security/devices");
}
