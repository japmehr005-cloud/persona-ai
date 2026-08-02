-- AlterTable
ALTER TABLE "user_settings" ALTER COLUMN "preferredAuthMethod" DROP NOT NULL,
ALTER COLUMN "preferredAuthMethod" DROP DEFAULT;
