import { prisma } from "@/lib/prisma";
import { CONTEXT_SIGNAL_WINDOW_MS } from "@/lib/constants";
import type { CallSignalSubtype } from "@/services/context-signals/inject-signal";

export interface ActiveCallSignal {
  active: boolean;
  subtype: CallSignalSubtype | null;
  detectedAt: Date | null;
}

/**
 * Abstraction over "is this user currently on a call". The hackathon backs
 * this with the existing simulated `CALL` context signal (Context Signal
 * Simulator); the interface is architecture-ready for a real mobile SDK
 * (call-state broadcast receiver on Android, CallKit on iOS) or a carrier
 * webhook to implement instead, without any caller — Risk Engine or the
 * pause-on-call transaction UX — needing to change.
 */
export interface CallDetectionProvider {
  getActiveCallSignal(userId: string): Promise<ActiveCallSignal>;
}

export class SimulatedCallDetectionProvider implements CallDetectionProvider {
  async getActiveCallSignal(userId: string): Promise<ActiveCallSignal> {
    const windowStart = new Date(Date.now() - CONTEXT_SIGNAL_WINDOW_MS);
    const signal = await prisma.contextSignal.findFirst({
      where: { userId, type: "CALL", transactionId: null, receivedAt: { gte: windowStart } },
      orderBy: { receivedAt: "desc" },
    });

    if (!signal) return { active: false, subtype: null, detectedAt: null };

    const payload = signal.payload as { subtype?: CallSignalSubtype | null };
    return { active: true, subtype: payload.subtype ?? null, detectedAt: signal.receivedAt };
  }
}

export const callDetectionProvider: CallDetectionProvider = new SimulatedCallDetectionProvider();

/** Whether the active call, if any, is a WhatsApp call specifically —
 * surfaced separately in the UI copy per the Mobile-First Security
 * requirement to distinguish carrier calls from WhatsApp calls. */
export function isWhatsAppCall(signal: ActiveCallSignal): boolean {
  return signal.active && signal.subtype === "whatsapp-call";
}
