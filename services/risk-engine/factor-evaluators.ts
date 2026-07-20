export interface RiskFactorResult {
  code: string;
  label: string;
  detail: string;
  weight: number;
  contribution: number;
}

export interface AmountContext {
  amount: number;
  avgAmount: number | null;
  p95Amount: number | null;
  stdDevAmount: number | null;
}

const AMOUNT_MAX_WEIGHT = 25;

export function evaluateAmountDeviation(ctx: AmountContext): RiskFactorResult | null {
  if (ctx.avgAmount === null || ctx.p95Amount === null || ctx.stdDevAmount === null) return null;

  const absAmount = Math.abs(ctx.amount);
  const zScore = ctx.stdDevAmount > 0 ? (absAmount - ctx.avgAmount) / ctx.stdDevAmount : 0;

  if (absAmount <= ctx.p95Amount && zScore < 2) return null;

  const multiple = ctx.avgAmount > 0 ? absAmount / ctx.avgAmount : 1;
  const severity = Math.min(1, Math.max(zScore / 4, (absAmount - ctx.p95Amount) / (ctx.p95Amount || 1)));

  return {
    code: "AMOUNT_DEVIATION",
    label: "Unusual amount",
    detail: `This amount is ${multiple.toFixed(1)}x your typical transaction size.`,
    weight: AMOUNT_MAX_WEIGHT,
    contribution: Math.round(AMOUNT_MAX_WEIGHT * Math.min(1, Math.max(0.3, severity))),
  };
}

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

const LOCATION_ANOMALY_WEIGHT = 15;

export function evaluateLocationAnomaly(locationFlagged: boolean): RiskFactorResult | null {
  if (!locationFlagged) return null;

  return {
    code: "LOCATION_ANOMALY",
    label: "Unusual location",
    detail: "This transaction appears to originate far from your usual locations.",
    weight: LOCATION_ANOMALY_WEIGHT,
    contribution: LOCATION_ANOMALY_WEIGHT,
  };
}

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

const SIMULATED_CALL_WEIGHT = 3;

export function evaluateSimulatedCall(callSignalActive: boolean): RiskFactorResult | null {
  if (!callSignalActive) return null;

  return {
    code: "SIMULATED_CALL",
    label: "Inbound call during transaction",
    detail: "A call signal was active while this transaction was being made.",
    weight: SIMULATED_CALL_WEIGHT,
    contribution: SIMULATED_CALL_WEIGHT,
  };
}

const SIMULATED_SMS_WEIGHT = 2;

export function evaluateSimulatedSms(smsSignalActive: boolean): RiskFactorResult | null {
  if (!smsSignalActive) return null;

  return {
    code: "SIMULATED_SMS",
    label: "Suspicious SMS pattern",
    detail: "An SMS matching known phishing/OTP-relay patterns was active.",
    weight: SIMULATED_SMS_WEIGHT,
    contribution: SIMULATED_SMS_WEIGHT,
  };
}
