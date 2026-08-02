-- CreateEnum
CREATE TYPE "SessionAuthMethod" AS ENUM ('PASSWORD_ONLY', 'PASSWORD_OTP', 'PASSWORD_BIOMETRIC', 'AUTHENTICATOR', 'TOTP_2FA');

-- AlterEnum
ALTER TYPE "FinEventType" ADD VALUE 'IMPOSSIBLE_TRAVEL_DETECTED';

-- AlterTable
ALTER TABLE "fraud_reports" ADD COLUMN     "severity" "AlertSeverity";

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "authMethod" "SessionAuthMethod",
ADD COLUMN     "riskScore" INTEGER,
ADD COLUMN     "riskTier" "RiskTier";
