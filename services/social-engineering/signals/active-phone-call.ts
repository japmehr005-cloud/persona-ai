import type { ActiveCallSignal } from "@/services/context-signals/call-detection";
import type { SocialEngineeringSignal } from "@/services/social-engineering/types";

/**
 * Maps the Context Intelligence call-detection abstraction into the
 * Social Engineering Protection signal model.
 *
 * Carrier phone calls and WhatsApp calls both surface as ACTIVE_PHONE_CALL
 * today (WhatsApp remains a subtype). A dedicated WHATSAPP_CALL plugin can
 * be registered later without changing this collector.
 */
export function toActivePhoneCallSignal(call: ActiveCallSignal): SocialEngineeringSignal {
  const isWhatsApp = call.subtype === "whatsapp-call";

  return {
    id: "ACTIVE_PHONE_CALL",
    label: isWhatsApp ? "Active WhatsApp call detected" : "Active phone call detected",
    active: call.active,
    subtype: call.subtype,
    detectedAt: call.detectedAt,
    detail: isWhatsApp
      ? "An active WhatsApp call was detected on your account while this transfer was initiated."
      : "An active phone call was detected on your account while this transfer was initiated.",
  };
}
