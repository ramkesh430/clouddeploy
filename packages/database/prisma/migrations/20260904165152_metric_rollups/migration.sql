-- CreateEnum
CREATE TYPE "MetricPeriod" AS ENUM ('HOURLY', 'DAILY');

-- CreateTable
CREATE TABLE "metric_rollups" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "period" "MetricPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "avgCpuPct" DOUBLE PRECISION,
    "maxCpuPct" DOUBLE PRECISION,
    "avgRamMb" DOUBLE PRECISION,
    "maxRamMb" DOUBLE PRECISION,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metric_rollups_serviceId_period_periodStart_idx" ON "metric_rollups"("serviceId", "period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "metric_rollups_serviceId_period_periodStart_key" ON "metric_rollups"("serviceId", "period", "periodStart");

-- AddForeignKey
ALTER TABLE "metric_rollups" ADD CONSTRAINT "metric_rollups_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
