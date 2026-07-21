/** Score at/above which a transaction is CRITICAL regardless of a user's
 * configured thresholds — this ceiling is not user-adjustable. */
export const CRITICAL_RISK_MIN = 80;

/** Default per-user risk thresholds (Settings → Risk Engine). Superseded by
 * `UserSettings.mediumRiskThreshold`/`highRiskThreshold` once a user has a
 * settings row; these are the values a brand-new row is created with. */
export const DEFAULT_MEDIUM_RISK_THRESHOLD = 25;
export const DEFAULT_HIGH_RISK_THRESHOLD = 60;

/** Server-enforced clamps so a customer can tune sensitivity without ever
 * disabling step-up verification outright or raising their own threshold
 * into CRITICAL territory. */
export const RISK_THRESHOLD_BOUNDS = {
  medium: { min: 10, max: 40 },
  high: { min: 40, max: 79 },
} as const;

/** Legacy single-threshold OTP trigger. Superseded by the medium/high
 * threshold pair above; kept as the default for `User.otpThreshold`, which
 * remains in the schema but is no longer read by the scoring path. */
export const DEFAULT_OTP_THRESHOLD = 71;

/** How long a HIGH/CRITICAL transaction's "context session" (High-Risk
 * Verification screen → Verify Identity → CB-OTP) stays open before it
 * expires and the transaction is denied. */
export const VERIFICATION_SESSION_TTL_MS = 10 * 60 * 1000;

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
