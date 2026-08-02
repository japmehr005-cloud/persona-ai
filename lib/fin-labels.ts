import type { AlertSeverity, FraudReportType, GovSource, RiskTier } from "@prisma/client";

import type { SecurityMapRiskColor } from "@/services/fin/geo-intelligence";

/** What actually won at sign-in — distinct from `PreferredAuthMethod`. */
export type SessionAuthMethodLiteral =
  | "PASSWORD_ONLY"
  | "PASSWORD_OTP"
  | "PASSWORD_BIOMETRIC"
  | "AUTHENTICATOR"
  | "TOTP_2FA";

export const AUTH_METHOD_LABEL: Record<SessionAuthMethodLiteral, string> = {
  PASSWORD_ONLY: "Password only",
  PASSWORD_OTP: "Password + OTP",
  PASSWORD_BIOMETRIC: "Password + Biometric",
  AUTHENTICATOR: "Mobile Authenticator",
  TOTP_2FA: "Password + Authenticator code",
};

export const RISK_TIER_LABEL: Record<RiskTier, string> = {
  LOW: "Low risk",
  MEDIUM: "Medium risk",
  HIGH: "High risk",
  CRITICAL: "Critical risk",
};

export const RISK_TIER_BADGE_CLASS: Record<RiskTier, string> = {
  LOW: "border-success/30 bg-success/10 text-success",
  MEDIUM: "border-warning/40 bg-warning/10 text-warning",
  HIGH: "border-destructive/40 bg-destructive/10 text-destructive",
  CRITICAL: "border-destructive bg-destructive/20 text-destructive",
};

export const RISK_COLOR_HEX: Record<SecurityMapRiskColor, string> = {
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
};

export const RISK_COLOR_LABEL: Record<SecurityMapRiskColor, string> = {
  green: "Trusted",
  amber: "Requires attention",
  red: "Reported fraud",
};

export const RISK_COLOR_BADGE_CLASS: Record<SecurityMapRiskColor, string> = {
  green: "border-success/30 bg-success/10 text-success",
  amber: "border-warning/40 bg-warning/10 text-warning",
  red: "border-destructive/40 bg-destructive/10 text-destructive",
};

export const FRAUD_REPORT_TYPE_LABEL: Record<FraudReportType, string> = {
  SUSPICIOUS_LOGIN: "Suspicious login",
  SUSPICIOUS_TRANSACTION: "Suspicious transaction",
  SUSPICIOUS_BENEFICIARY: "Suspicious beneficiary",
  NOT_ME: "This wasn't me",
};

export const SEVERITY_BADGE_CLASS: Record<AlertSeverity, string> = {
  LOW: "border-muted-foreground/30 bg-muted text-muted-foreground",
  MEDIUM: "border-warning/40 bg-warning/10 text-warning",
  HIGH: "border-destructive/40 bg-destructive/10 text-destructive",
};

export const GOV_SOURCE_LABEL: Record<GovSource, string> = {
  FRI: "Financial Fraud Risk Indicator (FRI)",
  MNRL: "Mobile Number Revocation List (MNRL)",
};
