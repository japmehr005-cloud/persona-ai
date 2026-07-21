import { prisma } from "@/lib/prisma";
import { CONTEXT_SIGNAL_WINDOW_MS } from "@/lib/constants";

export interface ActiveSignalView {
  id: string;
  type: "CALL" | "SMS" | "LOCATION" | "DEVICE";
  subtype: string | null;
  label: string;
  receivedAt: Date;
  expiresAt: Date;
}

export async function getActiveContextSignals(userId: string): Promise<ActiveSignalView[]> {
  const windowStart = new Date(Date.now() - CONTEXT_SIGNAL_WINDOW_MS);

  const signals = await prisma.contextSignal.findMany({
    where: { userId, transactionId: null, receivedAt: { gte: windowStart } },
    orderBy: { receivedAt: "desc" },
  });

  return signals.map((signal) => {
    const payload = signal.payload as { label?: string; subtype?: string | null };
    return {
      id: signal.id,
      type: signal.type,
      subtype: payload.subtype ?? null,
      label: payload.label ?? signal.type,
      receivedAt: signal.receivedAt,
      expiresAt: new Date(signal.receivedAt.getTime() + CONTEXT_SIGNAL_WINDOW_MS),
    };
  });
}
