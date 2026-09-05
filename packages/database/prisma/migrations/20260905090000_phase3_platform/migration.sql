-- CreateEnum
CREATE TYPE "ServerCommandType" AS ENUM ('DRAIN', 'ENTER_MAINTENANCE', 'EXIT_MAINTENANCE', 'RESTART_AGENT', 'DISABLE', 'RECONCILE_SERVICE', 'TERMINATE_CONTAINER');

-- CreateEnum
CREATE TYPE "ServerCommandStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('GENERAL', 'BILLING', 'DEPLOYMENT', 'DATABASE', 'DOMAIN', 'SECURITY', 'ABUSE');

-- CreateEnum
CREATE TYPE "RiskEventType" AS ENUM ('CPU_ABUSE', 'RAM_ABUSE', 'OUTBOUND_CONNECTION', 'SUSPICIOUS_PROCESS', 'CRYPTO_MINING', 'SPAM', 'MALWARE', 'PHISHING', 'BRUTE_FORCE', 'PORT_SCANNING');

-- CreateEnum
CREATE TYPE "RiskEventStatus" AS ENUM ('OPEN', 'REVIEWING', 'MITIGATED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AIAnalysisType" AS ENUM ('REPOSITORY', 'DEPLOYMENT_LOGS', 'DOCKERFILE', 'RESOURCES', 'ARCHITECTURE');

-- CreateEnum
CREATE TYPE "AIAnalysisStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AIFixActionType" AS ENUM ('ADD_ENVIRONMENT_VARIABLE', 'CONNECT_DATABASE', 'CHANGE_BUILD_COMMAND', 'CHANGE_START_COMMAND', 'GENERATE_DOCKERFILE', 'REDEPLOY');

-- CreateEnum
CREATE TYPE "AIFixProposalStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'APPLIED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgencyClientStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublicServiceStatus" AS ENUM ('OPERATIONAL', 'DEGRADED', 'PARTIAL_OUTAGE', 'MAJOR_OUTAGE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AbuseReportType" ADD VALUE 'PHISHING';
ALTER TYPE "AbuseReportType" ADD VALUE 'BRUTE_FORCE';
ALTER TYPE "AbuseReportType" ADD VALUE 'PORT_SCANNING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SupportTicketStatus" ADD VALUE 'WAITING_USER';
ALTER TYPE "SupportTicketStatus" ADD VALUE 'WAITING_SUPPORT';

-- DropIndex
DROP INDEX "containers_deploymentId_key";

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "allowedIpRanges" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rateLimitPerMinute" INTEGER;

-- AlterTable
ALTER TABLE "containers" ADD COLUMN     "healthy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastHealthAt" TIMESTAMP(3),
ADD COLUMN     "privateIp" TEXT,
ADD COLUMN     "replicaIndex" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- AlterTable
ALTER TABLE "regions" DROP COLUMN "isActive",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "servers" ADD COLUMN     "agentTokenHash" TEXT,
ADD COLUMN     "agentVersion" TEXT,
ADD COLUMN     "disabledReason" TEXT,
ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "category" "SupportTicketCategory" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "database_nodes" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "status" "NodeStatus" NOT NULL DEFAULT 'ONLINE',
    "databaseCount" INTEGER NOT NULL DEFAULT 0,
    "totalStorageMb" INTEGER NOT NULL,
    "usedStorageMb" INTEGER NOT NULL DEFAULT 0,
    "activeConnections" INTEGER NOT NULL DEFAULT 0,
    "backupHealthy" BOOLEAN NOT NULL DEFAULT true,
    "usedCpuPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedRamPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "database_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_nodes" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "status" "NodeStatus" NOT NULL DEFAULT 'ONLINE',
    "totalStorageMb" INTEGER NOT NULL,
    "usedStorageMb" INTEGER NOT NULL DEFAULT 0,
    "objectCount" INTEGER NOT NULL DEFAULT 0,
    "replicationHealthy" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_commands" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "type" "ServerCommandType" NOT NULL,
    "status" "ServerCommandStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "result" JSONB,
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "serviceId" TEXT,
    "type" "RiskEventType" NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "status" "RiskEventStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "recommendedActions" TEXT[],
    "actionTaken" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "deploymentId" TEXT,
    "createdById" TEXT NOT NULL,
    "type" "AIAnalysisType" NOT NULL,
    "status" "AIAnalysisStatus" NOT NULL DEFAULT 'COMPLETED',
    "provider" TEXT NOT NULL DEFAULT 'clouddeploy-local',
    "model" TEXT,
    "inputMetadata" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "secretsRedacted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_fix_proposals" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "actionType" "AIFixActionType" NOT NULL,
    "status" "AIFixProposalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "isSensitive" BOOLEAN NOT NULL DEFAULT true,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_fix_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_clients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "billingReference" TEXT,
    "status" "AgencyClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_projects" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "monthlyCostCents" INTEGER NOT NULL DEFAULT 0,
    "monthlyRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_portal_access" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "metricsReadOnly" BOOLEAN NOT NULL DEFAULT true,
    "invoicesVisible" BOOLEAN NOT NULL DEFAULT false,
    "deploymentStatus" BOOLEAN NOT NULL DEFAULT true,
    "domainStatus" BOOLEAN NOT NULL DEFAULT true,
    "supportAccess" BOOLEAN NOT NULL DEFAULT false,
    "accessTokenHash" TEXT,
    "lastAccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_portal_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_branding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "customDomain" TEXT,
    "primaryAccent" TEXT NOT NULL DEFAULT '#2563eb',
    "supportEmail" TEXT,
    "loginTitle" TEXT,
    "loginSubtitle" TEXT,
    "customLoginEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoscaling_policies" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minimumInstances" INTEGER NOT NULL DEFAULT 1,
    "maximumInstances" INTEGER NOT NULL DEFAULT 3,
    "cpuThresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "memoryThresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "requestThreshold" INTEGER,
    "scaleUpCooldownSeconds" INTEGER NOT NULL DEFAULT 120,
    "scaleDownCooldownSeconds" INTEGER NOT NULL DEFAULT 300,
    "lastScaleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autoscaling_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scaling_events" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "previousCount" INTEGER NOT NULL,
    "desiredCount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metricSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scaling_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "PublicServiceStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'INVESTIGATING',
    "description" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_services" (
    "incidentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "incident_services_pkey" PRIMARY KEY ("incidentId","serviceId")
);

-- CreateTable
CREATE TABLE "incident_updates" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "successful" BOOLEAN NOT NULL,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secret_access_audits" (
    "id" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "secret_access_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_sso_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "entityId" TEXT,
    "signInUrl" TEXT,
    "certificateCipher" TEXT,
    "enforced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_sso_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dedicatedRuntimeNodes" BOOLEAN NOT NULL DEFAULT false,
    "privateNetworkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dedicatedDatabase" BOOLEAN NOT NULL DEFAULT false,
    "slaTier" TEXT,
    "auditExportTarget" TEXT,
    "ipAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "backupRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "database_nodes_serverId_key" ON "database_nodes"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "storage_nodes_serverId_key" ON "storage_nodes"("serverId");

-- CreateIndex
CREATE INDEX "server_commands_serverId_status_createdAt_idx" ON "server_commands"("serverId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "risk_events_organizationId_status_createdAt_idx" ON "risk_events"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "risk_events_projectId_idx" ON "risk_events"("projectId");

-- CreateIndex
CREATE INDEX "ai_analyses_organizationId_createdAt_idx" ON "ai_analyses"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_analyses_projectId_createdAt_idx" ON "ai_analyses"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_fix_proposals_analysisId_status_idx" ON "ai_fix_proposals"("analysisId", "status");

-- CreateIndex
CREATE INDEX "agency_clients_organizationId_status_idx" ON "agency_clients"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agency_clients_organizationId_email_key" ON "agency_clients"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "client_projects_projectId_key" ON "client_projects"("projectId");

-- CreateIndex
CREATE INDEX "client_projects_clientId_idx" ON "client_projects"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_access_clientId_key" ON "client_portal_access"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "agency_branding_organizationId_key" ON "agency_branding"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "agency_branding_customDomain_key" ON "agency_branding"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "autoscaling_policies_serviceId_key" ON "autoscaling_policies"("serviceId");

-- CreateIndex
CREATE INDEX "autoscaling_policies_projectId_idx" ON "autoscaling_policies"("projectId");

-- CreateIndex
CREATE INDEX "scaling_events_serviceId_createdAt_idx" ON "scaling_events"("serviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_services_slug_key" ON "platform_services"("slug");

-- CreateIndex
CREATE INDEX "incidents_status_startedAt_idx" ON "incidents"("status", "startedAt");

-- CreateIndex
CREATE INDEX "incident_updates_incidentId_createdAt_idx" ON "incident_updates"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "recovery_codes_userId_usedAt_idx" ON "recovery_codes"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "login_events_userId_createdAt_idx" ON "login_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "secret_access_audits_secretId_createdAt_idx" ON "secret_access_audits"("secretId", "createdAt");

-- CreateIndex
CREATE INDEX "secret_access_audits_userId_createdAt_idx" ON "secret_access_audits"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "organization_sso_configs_organizationId_key" ON "organization_sso_configs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_settings_organizationId_key" ON "enterprise_settings"("organizationId");

-- CreateIndex
CREATE INDEX "containers_deploymentId_idx" ON "containers"("deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "containers_serviceId_replicaIndex_key" ON "containers"("serviceId", "replicaIndex");

-- CreateIndex
CREATE UNIQUE INDEX "servers_agentTokenHash_key" ON "servers"("agentTokenHash");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_region_fkey" FOREIGN KEY ("region") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_nodes" ADD CONSTRAINT "runtime_nodes_region_fkey" FOREIGN KEY ("region") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_workers" ADD CONSTRAINT "build_workers_region_fkey" FOREIGN KEY ("region") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "databases" ADD CONSTRAINT "databases_region_fkey" FOREIGN KEY ("region") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redis_instances" ADD CONSTRAINT "redis_instances_region_fkey" FOREIGN KEY ("region") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_buckets" ADD CONSTRAINT "storage_buckets_region_fkey" FOREIGN KEY ("region") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_region_fkey" FOREIGN KEY ("region") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_nodes" ADD CONSTRAINT "database_nodes_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_nodes" ADD CONSTRAINT "database_nodes_region_fkey" FOREIGN KEY ("region") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_nodes" ADD CONSTRAINT "storage_nodes_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_nodes" ADD CONSTRAINT "storage_nodes_region_fkey" FOREIGN KEY ("region") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_commands" ADD CONSTRAINT "server_commands_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_fix_proposals" ADD CONSTRAINT "ai_fix_proposals_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ai_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_fix_proposals" ADD CONSTRAINT "ai_fix_proposals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "agency_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_access" ADD CONSTRAINT "client_portal_access_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "agency_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_branding" ADD CONSTRAINT "agency_branding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoscaling_policies" ADD CONSTRAINT "autoscaling_policies_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoscaling_policies" ADD CONSTRAINT "autoscaling_policies_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scaling_events" ADD CONSTRAINT "scaling_events_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_services" ADD CONSTRAINT "incident_services_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_services" ADD CONSTRAINT "incident_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "platform_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secret_access_audits" ADD CONSTRAINT "secret_access_audits_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "secrets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secret_access_audits" ADD CONSTRAINT "secret_access_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_sso_configs" ADD CONSTRAINT "organization_sso_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enterprise_settings" ADD CONSTRAINT "enterprise_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
