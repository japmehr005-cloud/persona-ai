"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { registerDevice } from "@/services/security/register-device";
import { markDeviceTrusted } from "@/services/fin/device-intelligence";

const browserLocationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().nonnegative().nullable().optional(),
  })
  .nullable()
  .optional();

const registerDeviceSchema = z.object({
  fingerprintHash: z.string().min(1),
  label: z.string().min(1),
  userAgent: z.string().min(1),
  platform: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  screenResolution: z.string().optional(),
  hardwareConcurrency: z.number().int().nonnegative().nullable().optional(),
  colorDepth: z.number().int().nonnegative().nullable().optional(),
  browserLocation: browserLocationSchema,
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

  await registerDevice({
    userId: user.id,
    ...parsed.data,
    ipAddress,
    authMethod: user.authMethod ?? null,
    browserLocation: parsed.data.browserLocation ?? null,
  });

  // Keep Security Map / Devices pages fresh after a location-bearing registration.
  revalidatePath("/security/login-history");
  revalidatePath("/security/devices");
  revalidatePath("/admin/fin/soc");
}

export async function revokeDeviceAction(deviceId: string) {
  const user = await requireUser();

  await prisma.device.deleteMany({ where: { id: deviceId, userId: user.id } });
  revalidatePath("/security/devices");
}

export async function markDeviceTrustedAction(deviceId: string) {
  const user = await requireUser();
  await markDeviceTrusted(user.id, deviceId);
  revalidatePath("/security/devices");
  revalidatePath("/security/login-history");
}
