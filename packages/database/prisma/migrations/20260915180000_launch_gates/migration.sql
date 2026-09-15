-- AlterTable
ALTER TABLE "services" ADD COLUMN "imageDigest" TEXT;
ALTER TABLE "services" ADD COLUMN "imageSignature" TEXT;

-- AlterTable
ALTER TABLE "builds" ADD COLUMN "imageDigest" TEXT;
ALTER TABLE "builds" ADD COLUMN "imageSignature" TEXT;
ALTER TABLE "builds" ADD COLUMN "scanStatus" TEXT;
ALTER TABLE "builds" ADD COLUMN "scanCriticalCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "builds" ADD COLUMN "scanHighCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ssl_records" ADD COLUMN "lastError" TEXT;

-- AlterEnum
ALTER TYPE "DatabaseEngine" ADD VALUE 'MONGODB';
