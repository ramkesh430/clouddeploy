-- AlterTable
ALTER TABLE "containers" ADD COLUMN     "hostPort" INTEGER,
ADD COLUMN     "tunnelPid" INTEGER;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "imageTag" TEXT;
