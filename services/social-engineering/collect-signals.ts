import { callDetectionProvider } from "@/services/context-signals/call-detection";
import { toActivePhoneCallSignal } from "@/services/social-engineering/signals/active-phone-call";
import type { SocialEngineeringSnapshot } from "@/services/social-engineering/types";

/**
 * Collects Social Engineering signals for a user BEFORE Risk Engine scoring.
 *
 * CALL context signals are later quarantined so they cannot inflate the risk
 * score; this snapshot preserves the evidence for the SE engine.
 */
export async function collectSocialEngineeringSignals(
  userId: string
): Promise<SocialEngineeringSnapshot> {
  const call = await callDetectionProvider.getActiveCallSignal(userId);
  const phoneSignal = toActivePhoneCallSignal(call);

  return {
    signals: [phoneSignal],
    collectedAt: new Date(),
  };
}
