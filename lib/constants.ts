export const RISK_TIER_THRESHOLDS = {
  LOW_MAX: 30,
  MEDIUM_MAX: 70,
} as const;

export const DEFAULT_OTP_THRESHOLD = 71;

/** How long a simulated context signal (Context Signal Simulator) stays
 * "active" and eligible to influence the next transaction a user makes. */
export const CONTEXT_SIGNAL_WINDOW_MS = 10 * 60 * 1000;

export const TRANSACTION_CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Utilities",
  "Entertainment",
  "Shopping",
  "Travel",
  "Healthcare",
  "Transfer",
  "Income",
  "Subscriptions",
  "Other",
] as const;

export const APP_NAME = "Persona AI";
