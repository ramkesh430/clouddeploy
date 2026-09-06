-- AlterTable
ALTER TABLE "containers" ADD COLUMN     "lastCpuPct" DOUBLE PRECISION,
ADD COLUMN     "lastMetricAt" TIMESTAMP(3),
ADD COLUMN     "lastRamPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "risk_events" ADD COLUMN     "containerId" TEXT;

-- CreateIndex
CREATE INDEX "risk_events_containerId_idx" ON "risk_events"("containerId");

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
