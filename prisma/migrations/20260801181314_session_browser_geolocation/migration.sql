-- CreateEnum
CREATE TYPE "SessionLocationSource" AS ENUM ('BROWSER', 'IP', 'UNKNOWN');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "accuracy" DOUBLE PRECISION,
ADD COLUMN     "locationSource" "SessionLocationSource",
ADD COLUMN     "region" TEXT;
