"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function acknowledgeAlertAction(alertId: string) {
  const user = await requireUser();

  await prisma.alert.updateMany({
    where: { id: alertId, userId: user.id, status: "OPEN" },
    data: { status: "ACKNOWLEDGED" },
  });

  revalidatePath("/alerts");
  revalidatePath(`/alerts/${alertId}`);
  revalidatePath("/dashboard");
}

export async function resolveAlertAction(alertId: string) {
  const user = await requireUser();

  await prisma.alert.updateMany({
    where: { id: alertId, userId: user.id },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });

  revalidatePath("/alerts");
  revalidatePath(`/alerts/${alertId}`);
  revalidatePath("/dashboard");
}
