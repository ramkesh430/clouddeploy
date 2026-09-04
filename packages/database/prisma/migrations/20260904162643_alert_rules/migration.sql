-- CreateEnum
CREATE TYPE "AlertMetric" AS ENUM ('CPU_PCT', 'RAM_PCT', 'DATABASE_CONNECTIONS', 'DATABASE_STORAGE_PCT', 'REDIS_MEMORY_PCT');

-- CreateEnum
CREATE TYPE "AlertComparator" AS ENUM ('GREATER_THAN', 'LESS_THAN');

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "serviceId" TEXT,
    "databaseId" TEXT,
    "metric" "AlertMetric" NOT NULL,
    "comparator" "AlertComparator" NOT NULL DEFAULT 'GREATER_THAN',
    "threshold" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_rules_organizationId_idx" ON "alert_rules"("organizationId");

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
