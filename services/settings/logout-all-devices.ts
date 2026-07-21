import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/services/audit/audit-logger";

/**
 * Invalidates every JWT session currently issued for this user by bumping
 * `sessionVersion` — `lib/auth.ts`'s `jwt` callback re-checks this value
 * against the database on every request and signs a token out the moment
 * it no longer matches, so this takes effect immediately (including for
 * the browser that triggered it) rather than waiting for the 8h token
 * expiry.
 */
export async function logoutAllDevices(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });

  await logAuditEvent({
    userId,
    action: "LOGOUT_ALL_DEVICES",
    entityType: "User",
    entityId: userId,
  });
}
