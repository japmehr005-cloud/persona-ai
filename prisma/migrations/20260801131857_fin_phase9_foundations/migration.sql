/*
  Warnings:

  - Added the required column `userId` to the `otp_challenges` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('TRANSACTION', 'LOGIN');

-- CreateEnum
CREATE TYPE "PreferredAuthMethod" AS ENUM ('PASSWORD_OTP', 'PASSWORD_BIOMETRIC', 'AUTHENTICATOR');

-- CreateEnum
CREATE TYPE "TrustedLocationSource" AS ENUM ('SELF_REPORTED', 'AUTO_LEARNED');

-- CreateEnum
CREATE TYPE "FraudReportType" AS ENUM ('SUSPICIOUS_LOGIN', 'SUSPICIOUS_TRANSACTION', 'SUSPICIOUS_BENEFICIARY', 'NOT_ME');

-- CreateEnum
CREATE TYPE "FraudReportStatus" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "FinEventType" AS ENUM ('FRAUD_REPORT_FILED', 'FRAUD_REPORT_RESOLVED', 'DEVICE_FLAGGED', 'DEVICE_TRUSTED', 'DEVICE_SIMILARITY_MATCH', 'LOGIN_NEW_DEVICE', 'LOGIN_NEW_LOCATION', 'LOGIN_HIGH_RISK', 'LOGIN_STEP_UP_REQUIRED', 'LOGIN_STEP_UP_COMPLETED', 'MNRL_MATCH', 'FRI_HIT', 'CLUSTER_CREATED', 'CLUSTER_LINKED', 'OTP_CONTEXT_MISMATCH', 'TRANSACTION_PAUSED_CALL_ACTIVE');

-- CreateEnum
CREATE TYPE "ClusterEntityType" AS ENUM ('USER', 'DEVICE', 'BENEFICIARY', 'IP');

-- CreateEnum
CREATE TYPE "ClusterRiskLevel" AS ENUM ('WATCH', 'ELEVATED', 'CRITICAL');

-- CreateEnum
CREATE TYPE "GovSource" AS ENUM ('FRI', 'MNRL');

-- CreateEnum
CREATE TYPE "GovSubjectType" AS ENUM ('PHONE', 'ACCOUNT', 'BENEFICIARY');

-- CreateEnum
CREATE TYPE "GovRiskLevel" AS ENUM ('CLEAR', 'LOW', 'ELEVATED', 'HIGH');

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "colorDepth" INTEGER,
ADD COLUMN     "components" JSONB,
ADD COLUMN     "hardwareConcurrency" INTEGER,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "screenResolution" TEXT,
ADD COLUMN     "similarityKey" TEXT,
ADD COLUMN     "timezone" TEXT;

-- AlterTable
-- userId is added nullable first, backfilled from each existing challenge's
-- transaction -> account -> user, then tightened to NOT NULL — required
-- because this migration runs against a non-empty otp_challenges table.
ALTER TABLE "otp_challenges" ADD COLUMN     "deviceFingerprintHash" TEXT,
ADD COLUMN     "purpose" "OtpPurpose" NOT NULL DEFAULT 'TRANSACTION',
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "transactionId" DROP NOT NULL;

UPDATE "otp_challenges" AS oc
SET "userId" = acc."userId"
FROM "transactions" AS tx
JOIN "accounts" AS acc ON acc."id" = tx."accountId"
WHERE tx."id" = oc."transactionId" AND oc."userId" IS NULL;

ALTER TABLE "otp_challenges" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "risk_assessments" ADD COLUMN     "deviceSimilarityScore" INTEGER,
ADD COLUMN     "finRiskScore" INTEGER,
ADD COLUMN     "governmentRiskScore" INTEGER,
ADD COLUMN     "recommendation" TEXT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trusted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "preferredAuthMethod" "PreferredAuthMethod" NOT NULL DEFAULT 'PASSWORD_OTP';

-- CreateTable
CREATE TABLE "trusted_locations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "source" "TrustedLocationSource" NOT NULL DEFAULT 'AUTO_LEARNED',
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_reports" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "type" "FraudReportType" NOT NULL,
    "status" "FraudReportStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "transactionId" TEXT,
    "sessionId" TEXT,
    "deviceId" TEXT,
    "beneficiary" TEXT,
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "fraud_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_events" (
    "id" TEXT NOT NULL,
    "type" "FinEventType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT,
    "sessionId" TEXT,
    "transactionId" TEXT,
    "beneficiary" TEXT,
    "ipAddress" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_clusters" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "riskLevel" "ClusterRiskLevel" NOT NULL DEFAULT 'WATCH',
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_cluster_members" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "entityType" "ClusterEntityType" NOT NULL,
    "entityValue" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_cluster_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "government_risk_records" (
    "id" TEXT NOT NULL,
    "source" "GovSource" NOT NULL,
    "subjectType" "GovSubjectType" NOT NULL,
    "subjectValue" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "riskLevel" "GovRiskLevel" NOT NULL DEFAULT 'CLEAR',
    "details" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "government_risk_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trusted_locations_userId_idx" ON "trusted_locations"("userId");

-- CreateIndex
CREATE INDEX "fraud_reports_reporterUserId_idx" ON "fraud_reports"("reporterUserId");

-- CreateIndex
CREATE INDEX "fraud_reports_status_idx" ON "fraud_reports"("status");

-- CreateIndex
CREATE INDEX "fin_events_type_idx" ON "fin_events"("type");

-- CreateIndex
CREATE INDEX "fin_events_severity_idx" ON "fin_events"("severity");

-- CreateIndex
CREATE INDEX "fin_events_userId_idx" ON "fin_events"("userId");

-- CreateIndex
CREATE INDEX "fin_events_deviceId_idx" ON "fin_events"("deviceId");

-- CreateIndex
CREATE INDEX "fin_events_createdAt_idx" ON "fin_events"("createdAt");

-- CreateIndex
CREATE INDEX "fraud_cluster_members_entityType_entityValue_idx" ON "fraud_cluster_members"("entityType", "entityValue");

-- CreateIndex
CREATE UNIQUE INDEX "fraud_cluster_members_clusterId_entityType_entityValue_key" ON "fraud_cluster_members"("clusterId", "entityType", "entityValue");

-- CreateIndex
CREATE UNIQUE INDEX "government_risk_records_source_subjectType_subjectValue_key" ON "government_risk_records"("source", "subjectType", "subjectValue");

-- CreateIndex
CREATE INDEX "devices_similarityKey_idx" ON "devices"("similarityKey");

-- CreateIndex
CREATE INDEX "otp_challenges_userId_purpose_idx" ON "otp_challenges"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_locations" ADD CONSTRAINT "trusted_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_reports" ADD CONSTRAINT "fraud_reports_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_reports" ADD CONSTRAINT "fraud_reports_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_reports" ADD CONSTRAINT "fraud_reports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_reports" ADD CONSTRAINT "fraud_reports_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_reports" ADD CONSTRAINT "fraud_reports_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_events" ADD CONSTRAINT "fin_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_events" ADD CONSTRAINT "fin_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_events" ADD CONSTRAINT "fin_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_events" ADD CONSTRAINT "fin_events_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_cluster_members" ADD CONSTRAINT "fraud_cluster_members_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "fraud_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
