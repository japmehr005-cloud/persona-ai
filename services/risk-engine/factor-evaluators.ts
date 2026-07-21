import type {
  CallSignalSubtype,
  DeviceSignalSubtype,
  LocationSignalSubtype,
  SmsSignalSubtype,
} from "@/services/context-signals/inject-signal";

export interface RiskFactorResult {
  code: string;
  label: string;
  detail: string;
  weight: number;
  contribution: number;
}

// ---------------------------------------------------------------------------
// A. Transaction amount
// ---------------------------------------------------------------------------

export interface AmountContext {
  amount: number;
  avgAmount: number | null;
  p95Amount: number | null;
  stdDevAmount: number | null;
}

const AMOUNT_MAX_WEIGHT = 70;

/**
 * Uncapped-growth curve: unlike a linear/clamped model, a single extreme
 * outlier (e.g. 100x a customer's typical transaction) can alone push this
 * factor to its ceiling instead of saturating at a low fixed value —
 * log-growth means each additional multiple of deviation still adds risk,
 * just with diminishing returns, rather than being ignored past a cap.
 */
export function evaluateAmountDeviation(ctx: AmountContext): RiskFactorResult | null {
  if (ctx.avgAmount === null || ctx.p95Amount === null || ctx.stdDevAmount === null) return null;

  const absAmount = Math.abs(ctx.amount);
  const zScore = ctx.stdDevAmount > 0 ? (absAmount - ctx.avgAmount) / ctx.stdDevAmount : 0;

  if (absAmount <= ctx.p95Amount && zScore < 2) return null;

  const multiple = ctx.avgAmount > 0 ? absAmount / ctx.avgAmount : 1;
  const severity = Math.max(0, zScore, (absAmount - ctx.p95Amount) / (ctx.p95Amount || 1));
  const contribution = Math.round(Math.min(AMOUNT_MAX_WEIGHT, 12 + 14 * Math.log2(1 + severity)));

  return {
    code: "AMOUNT_DEVIATION",
    label: "Unusual amount",
    detail: `This amount is ${multiple.toFixed(1)}x your typical transaction size.`,
    weight: AMOUNT_MAX_WEIGHT,
    contribution,
  };
}

// ---------------------------------------------------------------------------
// B. Recipient familiarity
// ---------------------------------------------------------------------------

const NEW_MERCHANT_WEIGHT = 15;

export function evaluateNewMerchant(hasUsedMerchantBefore: boolean): RiskFactorResult | null {
  if (hasUsedMerchantBefore) return null;

  return {
    code: "NEW_MERCHANT",
    label: "Unfamiliar merchant",
    detail: "You haven't transacted with this merchant before.",
    weight: NEW_MERCHANT_WEIGHT,
    contribution: NEW_MERCHANT_WEIGHT,
  };
}

const NEW_RECIPIENT_WEIGHT = 20;
const DORMANT_RECIPIENT_WEIGHT = 12;

export interface RecipientContext {
  beneficiary: string | null;
  isFirstTimeBeneficiary: boolean;
  isDormantBeneficiary: boolean;
}

export function evaluateRecipientFamiliarity(ctx: RecipientContext): RiskFactorResult | null {
  if (!ctx.beneficiary) return null;

  if (ctx.isFirstTimeBeneficiary) {
    return {
      code: "NEW_RECIPIENT",
      label: "First-time recipient",
      detail: `You haven't sent money to ${ctx.beneficiary} before.`,
      weight: NEW_RECIPIENT_WEIGHT,
      contribution: NEW_RECIPIENT_WEIGHT,
    };
  }

  if (ctx.isDormantBeneficiary) {
    return {
      code: "DORMANT_RECIPIENT",
      label: "Dormant recipient",
      detail: `You haven't sent money to ${ctx.beneficiary} in over 90 days.`,
      weight: DORMANT_RECIPIENT_WEIGHT,
      contribution: DORMANT_RECIPIENT_WEIGHT,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// C. Transaction timing
// ---------------------------------------------------------------------------

const TIME_ANOMALY_WEIGHT = 10;
const TIME_ANOMALY_THRESHOLD = 0.02;

export function evaluateTimeAnomaly(hour: number, activeHours: number[] | null): RiskFactorResult | null {
  if (!activeHours || activeHours.length !== 24) return null;
  const frequency = activeHours[hour] ?? 0;
  if (frequency >= TIME_ANOMALY_THRESHOLD) return null;

  return {
    code: "TIME_ANOMALY",
    label: "Outside active hours",
    detail: `You rarely transact around ${formatHour(hour)}.`,
    weight: TIME_ANOMALY_WEIGHT,
    contribution: TIME_ANOMALY_WEIGHT,
  };
}

function formatHour(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

const WEEKDAY_ANOMALY_WEIGHT = 8;
const WEEKDAY_ANOMALY_THRESHOLD = 0.03;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function evaluateWeekdayAnomaly(weekday: number, activeDays: number[] | null): RiskFactorResult | null {
  if (!activeDays || activeDays.length !== 7) return null;
  const frequency = activeDays[weekday] ?? 0;
  if (frequency >= WEEKDAY_ANOMALY_THRESHOLD) return null;

  return {
    code: "WEEKDAY_ANOMALY",
    label: "Unusual day of week",
    detail: `You rarely transact on ${WEEKDAY_NAMES[weekday]}.`,
    weight: WEEKDAY_ANOMALY_WEIGHT,
    contribution: WEEKDAY_ANOMALY_WEIGHT,
  };
}

// ---------------------------------------------------------------------------
// D. Device trust & integrity
// ---------------------------------------------------------------------------

const NEW_DEVICE_WEIGHT = 20;

export function evaluateNewDevice(deviceTrusted: boolean | null): RiskFactorResult | null {
  if (deviceTrusted === null || deviceTrusted) return null;

  return {
    code: "NEW_DEVICE",
    label: "Unrecognized device",
    detail: "This transaction originated from a device we haven't verified as yours.",
    weight: NEW_DEVICE_WEIGHT,
    contribution: NEW_DEVICE_WEIGHT,
  };
}

const DEVICE_INTEGRITY_CONFIG: Record<DeviceSignalSubtype, { label: string; detail: string; weight: number } | null> = {
  rooted: {
    label: "Rooted device detected",
    detail: "This transaction originated from a device reporting root/jailbreak access, which can bypass mobile security controls.",
    weight: 25,
  },
  emulator: {
    label: "Emulator detected",
    detail: "This transaction originated from an emulated device rather than physical hardware — a common fraud-tooling pattern.",
    weight: 25,
  },
  "fingerprint-mismatch": {
    label: "Device fingerprint mismatch",
    detail: "This device's fingerprint changed unexpectedly mid-session, which can indicate spoofing.",
    weight: 18,
  },
  "screen-share": null,
  "remote-access": null,
  "accessibility-abuse": null,
};

export function evaluateDeviceIntegrity(subtype: DeviceSignalSubtype | null): RiskFactorResult | null {
  if (!subtype) return null;
  const config = DEVICE_INTEGRITY_CONFIG[subtype];
  if (!config) return null;

  return {
    code: `DEVICE_INTEGRITY_${subtype.toUpperCase().replace(/-/g, "_")}`,
    label: config.label,
    detail: config.detail,
    weight: config.weight,
    contribution: config.weight,
  };
}

// ---------------------------------------------------------------------------
// E. Location
// ---------------------------------------------------------------------------

const LOCATION_CONFIG: Record<LocationSignalSubtype, { label: string; detail: string; weight: number }> = {
  "impossible-travel": {
    label: "Impossible travel detected",
    detail: "This transaction appears to originate from a location that couldn't be reached from your last known location in the time elapsed.",
    weight: 30,
  },
  "new-city": {
    label: "Unusual location",
    detail: "This transaction appears to originate far from your usual locations.",
    weight: 15,
  },
  "new-region": {
    label: "New network region",
    detail: "This transaction's network location is in a region you haven't used before.",
    weight: 10,
  },
};

export function evaluateLocationAnomaly(severity: LocationSignalSubtype | null): RiskFactorResult | null {
  if (!severity) return null;
  const config = LOCATION_CONFIG[severity];

  return {
    code: `LOCATION_${severity.toUpperCase().replace(/-/g, "_")}`,
    label: config.label,
    detail: config.detail,
    weight: config.weight,
    contribution: config.weight,
  };
}

// ---------------------------------------------------------------------------
// F. Velocity
// ---------------------------------------------------------------------------

const VELOCITY_WEIGHT = 10;
const VELOCITY_THRESHOLD_1H = 3;

export function evaluateVelocity(txCountLastHour: number): RiskFactorResult | null {
  if (txCountLastHour < VELOCITY_THRESHOLD_1H) return null;

  return {
    code: "VELOCITY",
    label: "Rapid transaction activity",
    detail: `${txCountLastHour} transactions occurred in the last hour.`,
    weight: VELOCITY_WEIGHT,
    contribution: VELOCITY_WEIGHT,
  };
}

const RAPID_DRAIN_WEIGHT = 25;
const RAPID_DRAIN_RATIO_THRESHOLD = 0.5;

export function evaluateRapidBalanceDrain(
  txAmountLastDay: number,
  accountBalance: number | null
): RiskFactorResult | null {
  if (accountBalance === null || accountBalance <= 0) return null;
  const priorBalance = accountBalance + txAmountLastDay;
  if (priorBalance <= 0) return null;

  const ratio = txAmountLastDay / priorBalance;
  if (ratio < RAPID_DRAIN_RATIO_THRESHOLD) return null;

  const contribution = Math.round(Math.min(RAPID_DRAIN_WEIGHT, ratio * RAPID_DRAIN_WEIGHT));
  return {
    code: "RAPID_BALANCE_DRAIN",
    label: "Rapid balance drain",
    detail: `${Math.round(ratio * 100)}% of your balance has moved out in the last 24 hours.`,
    weight: RAPID_DRAIN_WEIGHT,
    contribution,
  };
}

const REPEATED_OTP_WEIGHT = 15;
const REPEATED_OTP_THRESHOLD = 3;

export function evaluateRepeatedOtpRequests(otpRequestCountLastHour: number): RiskFactorResult | null {
  if (otpRequestCountLastHour < REPEATED_OTP_THRESHOLD) return null;

  return {
    code: "REPEATED_OTP_REQUESTS",
    label: "Repeated verification requests",
    detail: `${otpRequestCountLastHour} verification codes were requested in the last hour.`,
    weight: REPEATED_OTP_WEIGHT,
    contribution: REPEATED_OTP_WEIGHT,
  };
}

const MULTIPLE_BENEFICIARIES_WEIGHT = 12;
const MULTIPLE_BENEFICIARIES_THRESHOLD = 3;

export function evaluateMultipleBeneficiaries(distinctBeneficiariesLastDay: number): RiskFactorResult | null {
  if (distinctBeneficiariesLastDay < MULTIPLE_BENEFICIARIES_THRESHOLD) return null;

  return {
    code: "MULTIPLE_BENEFICIARIES",
    label: "Multiple beneficiaries",
    detail: `You've sent money to ${distinctBeneficiariesLastDay} different people in the last 24 hours.`,
    weight: MULTIPLE_BENEFICIARIES_WEIGHT,
    contribution: MULTIPLE_BENEFICIARIES_WEIGHT,
  };
}

// ---------------------------------------------------------------------------
// G. Contextual fraud signals
// ---------------------------------------------------------------------------

const SIMULATED_CALL_WEIGHT = 3;
const UNKNOWN_CALLER_WEIGHT = 10;

export function evaluateSimulatedCall(
  callSignalActive: boolean,
  subtype: CallSignalSubtype | null
): RiskFactorResult | null {
  if (!callSignalActive) return null;

  if (subtype === "unknown-caller") {
    return {
      code: "SIMULATED_CALL_UNKNOWN_CALLER",
      label: "Active call from unknown caller",
      detail: "A call from a number outside your known contacts was active while this transaction was being made.",
      weight: UNKNOWN_CALLER_WEIGHT,
      contribution: UNKNOWN_CALLER_WEIGHT,
    };
  }

  return {
    code: "SIMULATED_CALL",
    label: "Inbound call during transaction",
    detail: "A call signal was active while this transaction was being made.",
    weight: SIMULATED_CALL_WEIGHT,
    contribution: SIMULATED_CALL_WEIGHT,
  };
}

const SIMULATED_SMS_WEIGHT = 2;
const SCAM_SMS_WEIGHT = 10;

export function evaluateSimulatedSms(
  smsSignalActive: boolean,
  subtype: SmsSignalSubtype | null
): RiskFactorResult | null {
  if (!smsSignalActive) return null;

  if (subtype === "scam-keywords") {
    return {
      code: "SIMULATED_SMS_SCAM_KEYWORDS",
      label: "Scam SMS keywords detected",
      detail: "An SMS containing known scam keywords (\"urgent\", \"verify now\", \"account blocked\") was active.",
      weight: SCAM_SMS_WEIGHT,
      contribution: SCAM_SMS_WEIGHT,
    };
  }

  return {
    code: "SIMULATED_SMS",
    label: "Suspicious SMS pattern",
    detail: "An SMS matching known phishing/OTP-relay patterns was active.",
    weight: SIMULATED_SMS_WEIGHT,
    contribution: SIMULATED_SMS_WEIGHT,
  };
}

const SCREEN_SHARE_WEIGHT = 22;

export function evaluateScreenShare(active: boolean): RiskFactorResult | null {
  if (!active) return null;

  return {
    code: "SCREEN_SHARE",
    label: "Screen sharing active",
    detail: "Screen sharing was active during this transaction, consistent with remote-assistance fraud scams.",
    weight: SCREEN_SHARE_WEIGHT,
    contribution: SCREEN_SHARE_WEIGHT,
  };
}

const REMOTE_ACCESS_WEIGHT = 25;

export function evaluateRemoteAccess(active: boolean): RiskFactorResult | null {
  if (!active) return null;

  return {
    code: "REMOTE_ACCESS",
    label: "Remote access software detected",
    detail: "Remote-control software (e.g. AnyDesk/TeamViewer) was detected running during this transaction.",
    weight: REMOTE_ACCESS_WEIGHT,
    contribution: REMOTE_ACCESS_WEIGHT,
  };
}

const ACCESSIBILITY_ABUSE_WEIGHT = 20;

export function evaluateAccessibilityAbuse(active: boolean): RiskFactorResult | null {
  if (!active) return null;

  return {
    code: "ACCESSIBILITY_ABUSE",
    label: "Accessibility-service abuse",
    detail: "Accessibility-service permissions were used in a pattern consistent with on-device fraud automation.",
    weight: ACCESSIBILITY_ABUSE_WEIGHT,
    contribution: ACCESSIBILITY_ABUSE_WEIGHT,
  };
}

// ---------------------------------------------------------------------------
// H. Behavior deviation
// ---------------------------------------------------------------------------

const BEHAVIOR_DEVIATION_WEIGHT = 10;
const BEHAVIOR_DEVIATION_RATIO_THRESHOLD = 3;

export interface BehaviorDeviationContext {
  amount: number;
  medianAmount: number | null;
  hasUsedMerchantBefore: boolean;
}

/**
 * Corroborating signal on top of `evaluateAmountDeviation`: puts the
 * (otherwise-unused) `BehavioralProfile.medianAmount` to work as a second,
 * independent baseline check — a large multiple of the *median* transaction
 * at an unfamiliar merchant is a stronger tell than either fact alone.
 */
export function evaluateBehaviorDeviation(ctx: BehaviorDeviationContext): RiskFactorResult | null {
  if (ctx.medianAmount === null || ctx.medianAmount <= 0 || ctx.hasUsedMerchantBefore) return null;

  const absAmount = Math.abs(ctx.amount);
  const ratio = absAmount / ctx.medianAmount;
  if (ratio < BEHAVIOR_DEVIATION_RATIO_THRESHOLD) return null;

  return {
    code: "BEHAVIOR_DEVIATION",
    label: "Deviates from personal baseline",
    detail: `This is ${ratio.toFixed(1)}x your median transaction at a merchant you don't normally use — well outside your typical pattern.`,
    weight: BEHAVIOR_DEVIATION_WEIGHT,
    contribution: BEHAVIOR_DEVIATION_WEIGHT,
  };
}
