import type { SocialEngineeringSignalId } from "@/services/social-engineering/types";

export interface SocialEngineeringSignalPlugin {
  id: SocialEngineeringSignalId;
  label: string;
  description: string;
  /** False until a real collector is wired for this signal. */
  implemented: boolean;
}

/**
 * Pluggable registry for Social Engineering signals.
 * Only ACTIVE_PHONE_CALL is implemented today; the rest are architectural stubs.
 */
export const SOCIAL_ENGINEERING_SIGNAL_REGISTRY: SocialEngineeringSignalPlugin[] = [
  {
    id: "ACTIVE_PHONE_CALL",
    label: "Active phone call",
    description: "Detects an ongoing carrier or VoIP phone call during a transfer.",
    implemented: true,
  },
  {
    id: "WHATSAPP_CALL",
    label: "WhatsApp call",
    description: "Dedicated WhatsApp/VoIP call detection (future).",
    implemented: false,
  },
  {
    id: "ACCESSIBILITY_SERVICES",
    label: "Accessibility services abuse",
    description: "Detects suspicious accessibility-service overlays used by scammers (future).",
    implemented: false,
  },
  {
    id: "REMOTE_CONTROL",
    label: "Remote control software",
    description: "Detects AnyDesk/TeamViewer-style remote access during transfers (future).",
    implemented: false,
  },
  {
    id: "SCREEN_SHARING",
    label: "Screen sharing",
    description: "Detects active screen-sharing sessions during transfers (future).",
    implemented: false,
  },
  {
    id: "SUPPORT_CALL",
    label: "Support call pattern",
    description: "Detects patterns consistent with fake bank-support calls (future).",
    implemented: false,
  },
  {
    id: "VIDEO_CALL",
    label: "Video call",
    description: "Detects active video calls during transfers (future).",
    implemented: false,
  },
];

export function getImplementedSignalIds(): SocialEngineeringSignalId[] {
  return SOCIAL_ENGINEERING_SIGNAL_REGISTRY.filter((plugin) => plugin.implemented).map(
    (plugin) => plugin.id
  );
}
