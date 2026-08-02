import { prisma } from "@/lib/prisma";
import type { PreferredAuthMethod } from "@prisma/client";

/**
 * Persists a customer's chosen Adaptive Authentication method (Settings →
 * Security → Sign-in method). This is a *preference*, not a hard floor —
 * `scoreLogin` can still force a stronger method for a suspicious login,
 * but never a weaker one than what's stored here.
 */
export async function updatePreferredAuthMethod(
  userId: string,
  method: PreferredAuthMethod | null
): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, preferredAuthMethod: method },
    update: { preferredAuthMethod: method },
  });
}
