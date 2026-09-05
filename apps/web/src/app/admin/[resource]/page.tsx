import { notFound } from "next/navigation";
import { AdminColumn, AdminResourcePage } from "@/components/admin/admin-resource-page";

interface ResourceConfig {
  title: string;
  description: string;
  endpoint: string;
  columns: AdminColumn[];
}

const resources: Record<string, ResourceConfig> = {
  users: table("Users", "Accounts, access posture, and suspension state.", "/admin/users", [["email", "Email"], ["fullName", "Name"], ["isPlatformAdmin", "Admin"], ["isSuspended", "Suspended"], ["twoFactorEnabled", "2FA"], ["createdAt", "Created"]]),
  organizations: table("Organizations", "Tenant subscriptions and resource counts.", "/admin/organizations", [["name", "Organization"], ["slug", "Slug"], ["subscription.plan.name", "Plan"], ["_count.members", "Members"], ["_count.projects", "Projects"], ["_count.databases", "Databases"]]),
  projects: table("Projects", "Projects across every tenant and region.", "/admin/projects", [["name", "Project"], ["organization.name", "Organization"], ["status", "Status"], ["region", "Region"], ["_count.services", "Services"], ["_count.deployments", "Deployments"]]),
  deployments: table("Deployments", "Recent releases, builds, and failures.", "/admin/deployments", [["project.name", "Project"], ["service.name", "Service"], ["status", "Status"], ["trigger", "Trigger"], ["build.status", "Build"], ["createdAt", "Created"]]),
  containers: table("Containers", "Replica placement and health across runtime nodes.", "/admin/containers", [["service.project.name", "Project"], ["service.name", "Service"], ["replicaIndex", "Replica"], ["status", "Status"], ["healthy", "Healthy"], ["runtimeNode.server.hostname", "Node"]]),
  databases: table("Databases", "Managed data services and utilization.", "/admin/databases", [["name", "Database"], ["organization.name", "Organization"], ["engine", "Engine"], ["status", "Status"], ["region", "Region"], ["storageUsedMb", "Used MB"]]),
  domains: table("Domains", "Routing and certificate state.", "/admin/domains", [["hostname", "Hostname"], ["organization.name", "Organization"], ["project.name", "Project"], ["status", "Status"], ["ssl.status", "SSL"], ["createdAt", "Created"]]),
  servers: table("Servers", "All registered infrastructure agents.", "/admin/infrastructure/servers", [["hostname", "Server"], ["role", "Role"], ["region", "Region"], ["status", "Status"], ["cpuCores", "CPU"], ["ramMb", "RAM MB"], ["lastHeartbeatAt", "Heartbeat"]]),
  "build-workers": table("Build workers", "Regional build capacity, queue, and health.", "/admin/infrastructure/servers?role=BUILD_WORKER", [["hostname", "Worker"], ["region", "Region"], ["buildWorker.currentBuilds", "Current"], ["buildWorker.maxConcurrentBuilds", "Capacity"], ["metrics.0.cpuPct", "CPU %"], ["metrics.0.ramPct", "RAM %"], ["status", "Health"]]),
  "runtime-nodes": table("Runtime nodes", "Healthy replica capacity by region.", "/admin/infrastructure/servers?role=RUNTIME_NODE", [["hostname", "Node"], ["region", "Region"], ["runtimeNode.currentContainers", "Containers"], ["cpuCores", "CPU"], ["ramMb", "RAM MB"], ["diskMb", "Disk MB"], ["status", "Health"]]),
  "database-nodes": table("Database nodes", "Database placement, storage, and backup health.", "/admin/infrastructure/servers?role=DATABASE_NODE", [["hostname", "Node"], ["region", "Region"], ["databaseNode.databaseCount", "Databases"], ["databaseNode.activeConnections", "Connections"], ["databaseNode.backupHealthy", "Backups"], ["status", "Health"]]),
  "storage-nodes": table("Storage nodes", "Object capacity and replication health.", "/admin/infrastructure/servers?role=STORAGE_NODE", [["hostname", "Node"], ["region", "Region"], ["storageNode.objectCount", "Objects"], ["storageNode.usedStorageMb", "Used MB"], ["storageNode.replicationHealthy", "Replication"], ["status", "Health"]]),
  infrastructure: table("Infrastructure capacity", "Live compute, storage, database, and build capacity.", "/admin/infrastructure/capacity", [["totalCpu", "Total CPU"], ["usedCpu", "Used CPU"], ["totalRamMb", "Total RAM MB"], ["usedRamMb", "Used RAM MB"], ["nodeCount", "Nodes"], ["currentContainers", "Containers"], ["buildQueueDepth", "Build queue"]]),
  plans: table("Plans", "Commercial tiers and subscription adoption.", "/admin/plans", [["name", "Plan"], ["tier", "Tier"], ["priceMonthlyCents", "Monthly ¢"], ["maxProjects", "Projects"], ["maxRamMb", "RAM MB"], ["_count.subscriptions", "Subscriptions"]]),
  subscriptions: table("Subscriptions", "Recurring commercial relationships.", "/admin/subscriptions", [["organization.name", "Organization"], ["plan.name", "Plan"], ["status", "Status"], ["billingPeriod", "Period"], ["currentPeriodEnd", "Renews"], ["cancelAtPeriodEnd", "Cancels"]]),
  transactions: table("Transactions", "Payment outcomes and provider references.", "/admin/transactions", [["invoice.organization.name", "Organization"], ["provider", "Provider"], ["providerPaymentId", "Reference"], ["status", "Status"], ["amountCents", "Amount ¢"], ["createdAt", "Created"]]),
  usage: table("Usage", "Metered consumption used for billing and capacity planning.", "/admin/usage", [["organization.name", "Organization"], ["metricType", "Metric"], ["quantity", "Quantity"], ["unit", "Unit"], ["periodStart", "Period start"], ["periodEnd", "Period end"]]),
  support: table("Support tickets", "Customer issues, priority, assignment, and response state.", "/admin/support/tickets", [["subject", "Subject"], ["user.email", "Customer"], ["category", "Category"], ["priority", "Priority"], ["status", "Status"], ["assignedAdmin.fullName", "Assigned"], ["_count.messages", "Messages"]]),
  abuse: table("Abuse and risk events", "Detected risk signals and human review workflow.", "/admin/abuse/risk-events", [["type", "Risk"], ["severity", "Severity"], ["status", "Status"], ["organization.name", "Organization"], ["project.name", "Project"], ["detectedAt", "Detected"]]),
  status: table("Status management", "Published incidents and customer-facing operational state.", "/admin/status/incidents", [["title", "Incident"], ["severity", "Severity"], ["status", "Status"], ["startedAt", "Started"], ["resolvedAt", "Resolved"], ["services", "Affected services"]]),
  analytics: table("Platform analytics", "Commercial and workload growth for the last 30 days.", "/admin/analytics", [["mrrCents", "MRR ¢"], ["arrCents", "ARR ¢"], ["churnPct", "Churn %"], ["newUsers", "New users"], ["activeOrganizations", "Active orgs"], ["failedDeploymentRatePct", "Failure %"], ["averageBuildDurationMs", "Avg build ms"]]),
  "system-logs": table("System logs", "Tenant-aware control-plane audit history.", "/admin/system-logs", [["action", "Action"], ["resourceType", "Resource"], ["resourceId", "Resource ID"], ["user.email", "Actor"], ["organization.name", "Organization"], ["ipAddress", "IP"], ["createdAt", "Created"]]),
  security: table("Security posture", "2FA, login risk, API key controls, SSO, and secret access.", "/admin/security", [["twoFactorUsers", "2FA users"], ["suspiciousLogins", "Suspicious logins"], ["activeApiKeys", "Active API keys"], ["ipRestrictedKeys", "IP restricted"], ["ssoOrganizations", "SSO enforced"], ["recentSecretAccess", "Recent secret access"]]),
};

function table(title: string, description: string, endpoint: string, columns: Array<[string, string]>): ResourceConfig {
  return { title, description, endpoint, columns: columns.map(([key, label]) => ({ key, label })) };
}

export default function AdminResourceRoute({ params }: { params: { resource: string } }) {
  const config = resources[params.resource];
  if (!config) notFound();
  return <AdminResourcePage {...config} />;
}
