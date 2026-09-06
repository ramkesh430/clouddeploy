import { notFound } from "next/navigation";
import { AdminColumn, AdminResourcePage, ResourceCrudConfig } from "@/components/admin/admin-resource-page";

interface ResourceConfig {
  title: string;
  description: string;
  endpoint: string;
  columns: AdminColumn[];
  crud?: ResourceCrudConfig;
}

const resources: Record<string, ResourceConfig> = {
  organizations: table(
    "Organizations",
    "Tenant subscriptions and resource counts.",
    "/admin/organizations",
    [["name", "Organization"], ["slug", "Slug"], ["subscription.plan.name", "Plan"], ["_count.members", "Members"], ["_count.projects", "Projects"], ["_count.databases", "Databases"]],
    {
      createFields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "slug", label: "Slug", type: "text", required: true, placeholder: "acme-inc" },
        { key: "isAgency", label: "Agency account", type: "checkbox" },
      ],
      editFields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "slug", label: "Slug", type: "text", required: true },
        { key: "isAgency", label: "Agency account", type: "checkbox" },
      ],
      canDelete: true,
    },
  ),
  projects: table(
    "Projects",
    "Projects across every tenant and region.",
    "/admin/projects",
    [["name", "Project"], ["organization.name", "Organization"], ["status", "Status"], ["region", "Region"], ["_count.services", "Services"], ["_count.deployments", "Deployments"]],
    {
      createFields: [
        { key: "organizationId", label: "Organization", type: "select", required: true, dynamicSource: "organizations" },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "slug", label: "Slug", type: "text", required: true, placeholder: "my-project" },
        { key: "region", label: "Region", type: "select", dynamicSource: "regions" },
      ],
      editFields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "status", label: "Status", type: "select", options: enumOptions(["ACTIVE", "PAUSED", "ARCHIVED"]) },
        { key: "region", label: "Region", type: "select", dynamicSource: "regions" },
      ],
      canDelete: true,
    },
  ),
  deployments: table("Deployments", "Recent releases, builds, and failures.", "/admin/deployments", [["project.name", "Project"], ["service.name", "Service"], ["status", "Status"], ["trigger", "Trigger"], ["build.status", "Build"], ["createdAt", "Created"]]),
  services: table("Services", "Every service across every project and tenant.", "/admin/services", [["name", "Service"], ["project.name", "Project"], ["type", "Type"], ["runtime", "Runtime"], ["status", "Status"], ["instances", "Instances"]]),
  storage: table("Storage buckets", "Object storage buckets across every tenant.", "/admin/storage-buckets", [["name", "Bucket"], ["organization.name", "Organization"], ["region", "Region"], ["isPublic", "Public"], ["_count.objects", "Objects"], ["createdAt", "Created"]]),
  containers: table("Containers", "Replica placement and health across runtime nodes.", "/admin/containers", [["service.project.name", "Project"], ["service.name", "Service"], ["replicaIndex", "Replica"], ["status", "Status"], ["healthy", "Healthy"], ["runtimeNode.server.hostname", "Node"]]),
  databases: table("Databases", "Managed data services and utilization.", "/admin/databases", [["name", "Database"], ["organization.name", "Organization"], ["engine", "Engine"], ["status", "Status"], ["region", "Region"], ["storageUsedMb", "Used MB"]]),
  domains: table(
    "Domains",
    "Routing and certificate state.",
    "/admin/domains",
    [["hostname", "Hostname"], ["organization.name", "Organization"], ["project.name", "Project"], ["status", "Status"], ["ssl.status", "SSL"], ["createdAt", "Created"]],
    {
      createFields: [
        { key: "organizationId", label: "Organization", type: "select", required: true, dynamicSource: "organizations" },
        { key: "projectId", label: "Project", type: "select", required: true, dynamicSource: "projects", dependsOn: "organizationId" },
        { key: "hostname", label: "Hostname", type: "text", required: true, placeholder: "app.example.com" },
        { key: "type", label: "Type", type: "select", options: enumOptions(["CUSTOM", "PLATFORM"]) },
        { key: "environment", label: "Environment", type: "select", options: enumOptions(["PRODUCTION", "PREVIEW", "DEVELOPMENT"]) },
      ],
      editFields: [
        { key: "status", label: "Status", type: "select", options: enumOptions(["PENDING", "VERIFYING", "ACTIVE", "FAILED"]) },
        { key: "environment", label: "Environment", type: "select", options: enumOptions(["PRODUCTION", "PREVIEW", "DEVELOPMENT"]) },
      ],
      canDelete: true,
    },
  ),
  servers: table("Servers", "All registered infrastructure agents.", "/admin/infrastructure/servers", [["hostname", "Server"], ["role", "Role"], ["region", "Region"], ["status", "Status"], ["cpuCores", "CPU"], ["ramMb", "RAM MB"], ["lastHeartbeatAt", "Heartbeat"]]),
  "build-workers": table("Build workers", "Regional build capacity, queue, and health.", "/admin/infrastructure/servers?role=BUILD_WORKER", [["hostname", "Worker"], ["region", "Region"], ["buildWorker.currentBuilds", "Current"], ["buildWorker.maxConcurrentBuilds", "Capacity"], ["metrics.0.cpuPct", "CPU %"], ["metrics.0.ramPct", "RAM %"], ["status", "Health"]]),
  "runtime-nodes": table("Runtime nodes", "Healthy replica capacity by region.", "/admin/infrastructure/servers?role=RUNTIME_NODE", [["hostname", "Node"], ["region", "Region"], ["runtimeNode.currentContainers", "Containers"], ["cpuCores", "CPU"], ["ramMb", "RAM MB"], ["diskMb", "Disk MB"], ["status", "Health"]]),
  "database-nodes": table("Database nodes", "Database placement, storage, and backup health.", "/admin/infrastructure/servers?role=DATABASE_NODE", [["hostname", "Node"], ["region", "Region"], ["databaseNode.databaseCount", "Databases"], ["databaseNode.activeConnections", "Connections"], ["databaseNode.backupHealthy", "Backups"], ["status", "Health"]]),
  "storage-nodes": table("Storage nodes", "Object capacity and replication health.", "/admin/infrastructure/servers?role=STORAGE_NODE", [["hostname", "Node"], ["region", "Region"], ["storageNode.objectCount", "Objects"], ["storageNode.usedStorageMb", "Used MB"], ["storageNode.replicationHealthy", "Replication"], ["status", "Health"]]),
  infrastructure: table("Infrastructure capacity", "Live compute, storage, database, and build capacity.", "/admin/infrastructure/capacity", [["totalCpu", "Total CPU"], ["usedCpu", "Used CPU"], ["totalRamMb", "Total RAM MB"], ["usedRamMb", "Used RAM MB"], ["nodeCount", "Nodes"], ["currentContainers", "Containers"], ["buildQueueDepth", "Build queue"]]),
  plans: table(
    "Plans",
    "Commercial tiers and subscription adoption.",
    "/admin/plans",
    [["name", "Plan"], ["tier", "Tier"], ["priceMonthlyCents", "Monthly ¢"], ["maxProjects", "Projects"], ["maxRamMb", "RAM MB"], ["_count.subscriptions", "Subscriptions"]],
    {
      createFields: [
        { key: "tier", label: "Tier", type: "select", required: true, options: enumOptions(["FREE", "DEVELOPER", "PRO", "BUSINESS", "ENTERPRISE"]) },
        { key: "name", label: "Display name", type: "text", required: true },
        { key: "priceMonthlyCents", label: "Monthly price (cents)", type: "number", required: true },
        { key: "priceYearlyCents", label: "Yearly price (cents)", type: "number", required: true },
        { key: "maxProjects", label: "Max projects", type: "number", required: true },
        { key: "maxRamMb", label: "Max RAM (MB)", type: "number", required: true },
      ],
      editFields: [
        { key: "name", label: "Display name", type: "text", required: true },
        { key: "priceMonthlyCents", label: "Monthly price (cents)", type: "number", required: true },
        { key: "priceYearlyCents", label: "Yearly price (cents)", type: "number", required: true },
        { key: "maxProjects", label: "Max projects", type: "number", required: true },
        { key: "maxRamMb", label: "Max RAM (MB)", type: "number", required: true },
      ],
      canDelete: true,
    },
  ),
  subscriptions: table(
    "Subscriptions",
    "Recurring commercial relationships.",
    "/admin/subscriptions",
    [["organization.name", "Organization"], ["plan.name", "Plan"], ["status", "Status"], ["billingPeriod", "Period"], ["currentPeriodEnd", "Renews"], ["cancelAtPeriodEnd", "Cancels"]],
    {
      createFields: [
        { key: "organizationId", label: "Organization", type: "select", required: true, dynamicSource: "organizations" },
        { key: "planId", label: "Plan", type: "select", required: true, dynamicSource: "plans" },
        { key: "billingPeriod", label: "Billing period", type: "select", options: enumOptions(["monthly", "yearly"]) },
        { key: "status", label: "Status", type: "select", options: enumOptions(["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED", "INCOMPLETE"]) },
      ],
      editFields: [
        { key: "planId", label: "Plan", type: "select", dynamicSource: "plans" },
        { key: "status", label: "Status", type: "select", options: enumOptions(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "INCOMPLETE"]) },
      ],
    },
  ),
  transactions: table("Transactions", "Payment outcomes and provider references.", "/admin/transactions", [["invoice.organization.name", "Organization"], ["provider", "Provider"], ["providerPaymentId", "Reference"], ["status", "Status"], ["amountCents", "Amount ¢"], ["createdAt", "Created"]]),
  usage: table("Usage", "Metered consumption used for billing and capacity planning.", "/admin/usage", [["organization.name", "Organization"], ["metricType", "Metric"], ["quantity", "Quantity"], ["unit", "Unit"], ["periodStart", "Period start"], ["periodEnd", "Period end"]]),
  abuse: table("Abuse and risk events", "Detected risk signals and human review workflow.", "/admin/abuse/risk-events", [["type", "Risk"], ["severity", "Severity"], ["status", "Status"], ["organization.name", "Organization"], ["project.name", "Project"], ["detectedAt", "Detected"]]),
  "alert-rules": table("Alert rules", "Customer-configured monitoring thresholds, for support and debugging visibility.", "/admin/alert-rules", [["organization.name", "Organization"], ["metric", "Metric"], ["comparator", "Comparator"], ["threshold", "Threshold"], ["enabled", "Enabled"], ["lastTriggeredAt", "Last triggered"]]),
  webhooks: table("Webhooks", "Customer-configured delivery endpoints, for support and debugging visibility.", "/admin/webhooks", [["organization.name", "Organization"], ["url", "URL"], ["events", "Events"], ["isActive", "Active"], ["_count.deliveries", "Deliveries"], ["createdAt", "Created"]]),
  analytics: table("Platform analytics", "Commercial and workload growth for the last 30 days.", "/admin/analytics", [["mrrCents", "MRR ¢"], ["arrCents", "ARR ¢"], ["churnPct", "Churn %"], ["newUsers", "New users"], ["activeOrganizations", "Active orgs"], ["failedDeploymentRatePct", "Failure %"], ["averageBuildDurationMs", "Avg build ms"]]),
  "system-logs": table("System logs", "Tenant-aware control-plane audit history.", "/admin/system-logs", [["action", "Action"], ["resourceType", "Resource"], ["resourceId", "Resource ID"], ["user.email", "Actor"], ["organization.name", "Organization"], ["ipAddress", "IP"], ["createdAt", "Created"]]),
  security: table("Security posture", "2FA, login risk, API key controls, SSO, and secret access.", "/admin/security", [["twoFactorUsers", "2FA users"], ["suspiciousLogins", "Suspicious logins"], ["activeApiKeys", "Active API keys"], ["ipRestrictedKeys", "IP restricted"], ["ssoOrganizations", "SSO enforced"], ["recentSecretAccess", "Recent secret access"]]),
};

function enumOptions(values: string[]): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: value }));
}

function table(title: string, description: string, endpoint: string, columns: Array<[string, string]>, crud?: ResourceCrudConfig): ResourceConfig {
  return { title, description, endpoint, columns: columns.map(([key, label]) => ({ key, label })), crud };
}

export default function AdminResourceRoute({ params }: { params: { resource: string } }) {
  const config = resources[params.resource];
  if (!config) notFound();
  return <AdminResourcePage {...config} />;
}
