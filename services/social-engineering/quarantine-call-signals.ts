import { prisma } from "@/lib/prisma";
import { CONTEXT_SIGNAL_WINDOW_MS } from "@/lib/constants";

/**
 * Removes pending CALL context signals from the Risk Engine's active window
 * WITHOUT modifying any Risk Engine code.
 *
 * `buildContextBundle` only loads signals with `transactionId: null` and
 * `receivedAt` within the window. By pushing `receivedAt` outside that
 * window we ensure `callSignalActive` is always false during scoring, while
 * Social Engineering Protection uses its own pre-quarantine snapshot.
 */
export async function quarantineCallSignalsForRiskIsolation(userId: string): Promise<number> {
  const windowStart = new Date(Date.now() - CONTEXT_SIGNAL_WINDOW_MS);
  /** Far enough in the past that the signal is outside CONTEXT_SIGNAL_WINDOW_MS. */
  const quarantinedAt = new Date(Date.now() - CONTEXT_SIGNAL_WINDOW_MS - 60_000);

  const result = await prisma.contextSignal.updateMany({
    where: {
      userId,
      type: "CALL",
      transactionId: null,
      receivedAt: { gte: windowStart },
    },
    data: { receivedAt: quarantinedAt },
  });

  return result.count;
}
