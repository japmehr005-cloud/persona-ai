import { prisma } from "@/lib/prisma";

export async function updateDeveloperSettings(userId: string, showRiskDebugPanel: boolean): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, showRiskDebugPanel },
    update: { showRiskDebugPanel },
  });
}
