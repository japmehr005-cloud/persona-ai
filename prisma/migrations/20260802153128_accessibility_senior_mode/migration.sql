-- CreateEnum
CREATE TYPE "UiLocale" AS ENUM ('EN', 'HI', 'PA');

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "a11yOnboardingSeen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "highContrast" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "largeText" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seniorMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "uiLocale" "UiLocale" NOT NULL DEFAULT 'EN',
ADD COLUMN     "voiceResponses" BOOLEAN NOT NULL DEFAULT false;
