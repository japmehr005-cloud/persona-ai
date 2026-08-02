/**
 * Social Engineering Protection — independent security layer.
 *
 * This engine NEVER mutates or contributes to the Risk Engine score.
 * It only decides whether a transaction should be interrupted for
 * protective verification (PAUSED_FOR_VERIFICATION).
 */

/** Implemented today: ACTIVE_PHONE_CALL. Remaining IDs are reserved for future signal plugins. */
export type SocialEngineeringSignalId =
  | "ACTIVE_PHONE_CALL"
  | "WHATSAPP_CALL"
  | "ACCESSIBILITY_SERVICES"
  | "REMOTE_CONTROL"
  | "SCREEN_SHARING"
  | "SUPPORT_CALL"
  | "VIDEO_CALL";

export interface SocialEngineeringSignal {
  id: SocialEngineeringSignalId;
  /** Human-readable label for UI / FIN summaries. */
  label: string;
  /** True when this signal is currently active for the user. */
  active: boolean;
  /** Optional subtype from the underlying detection provider. */
  subtype: string | null;
  detectedAt: Date | null;
  /** Short customer-facing explanation of why this signal matters. */
  detail: string;
}

export type SocialEngineeringRecommendedAction =
  | "ALLOW"
  | "PAUSE_FOR_VERIFICATION";

export interface SocialEngineeringEvaluation {
  /** True when at least one active signal requires interruption. */
  triggered: boolean;
  signals: SocialEngineeringSignal[];
  /** Active signals only — convenient for UI panels. */
  activeSignals: SocialEngineeringSignal[];
  explanation: string;
  recommendedAction: SocialEngineeringRecommendedAction;
}

/** Snapshot collected before Risk Engine scoring so CALL quarantine cannot erase SE evidence. */
export interface SocialEngineeringSnapshot {
  signals: SocialEngineeringSignal[];
  collectedAt: Date;
}
