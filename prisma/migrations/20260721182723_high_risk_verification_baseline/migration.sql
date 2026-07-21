-- AlterTable
ALTER TABLE "risk_assessments" ADD COLUMN     "baselineAvgAmount" DECIMAL(14,2),
ADD COLUMN     "baselineMedianAmount" DECIMAL(14,2),
ADD COLUMN     "baselineP95Amount" DECIMAL(14,2),
ADD COLUMN     "baselineSampleSize" INTEGER,
ADD COLUMN     "deviceTrusted" BOOLEAN;
