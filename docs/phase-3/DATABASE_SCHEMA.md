# Phase 3 database schema

The canonical schema is [`packages/database/prisma/schema.prisma`](../../packages/database/prisma/schema.prisma). Migrations are additive and preserve Phase 1/2 data.

## Core tenancy and workload

- `User`, `Session`, `Organization`, `OrganizationMember`, `Project`, `ProjectMember`
- `Repository`, `Service`, `Deployment`, `Build`, `DeploymentLog`, `Container`
- `Database`, `RedisInstance`, `StorageBucket`, `Domain`, `SSLCertificate`
- `EnvironmentVariable`, `SecretAccessAudit`, `Metric`, `MetricRollup`, `UsageRecord`

`Container` is replica-aware through `replicaIndex`, health, private IP, runtime-node placement, and deployment linkage. `Project.region` references `Region.code`. Database, Redis, storage, workers, and nodes carry the same regional key.

## AI and reviewed actions

- `AIAnalysis`: analysis type/status, structured JSON result, secret-redaction count, actor, organization/project/deployment relationships.
- `AIFixProposal`: typed action, structured payload, sensitivity flag, review/apply/reject state, reviewer, and timestamps.

No raw repository snapshot or raw supplied deployment log is stored in these models.

## Marketplace

- `TemplateCategory`: category metadata and ordering.
- `Template`: slug, presentation data, tags, structured deployment definition, publication and featured state.

The JSON definition is validated by the application contract and can describe multiple services plus managed dependencies.

## Agency and enterprise

- `AgencyClient`, `ClientProject`: customer identity and project-specific cost/revenue.
- `ClientPortalAccess`: per-client read-only grants.
- `AgencyBranding`: logo, brand name, custom domain, UI accent, support email, login-screen content.
- `EnterpriseSettings`, `OrganizationSsoConfig`: dedicated nodes/database, private networking, SLA, retention, allowlists, SSO/SAML-ready metadata.

## Regions, servers, and elasticity

- `Region`: code, location metadata, active scheduling flag.
- `Server`: region, node role, lifecycle status, capacity, agent hash, heartbeat.
- `RuntimeNode`, `BuildWorker`, `DatabaseNode`, `StorageNode`, `ServerMetric`, `ServerCommand`.
- `AutoscalingPolicy`, `ScalingEvent`.

Important indexes cover region/status scheduling, tenant/status lists, time-ordered analytics, risk review, and incident queries. The scheduler additionally uses live capacity values from node and metric records.

## Operations and trust

- `SupportTicket`, `SupportMessage`
- `AbuseReport`, `RiskEvent`
- `PlatformService`, `Incident`, `IncidentService`, `IncidentUpdate`
- `RecoveryCode`, `LoginEvent`, `APIKey`, `AuditLog`

Referential actions intentionally use a mix of cascade for tenant-owned children and set-null for historical actor/resource references. Operational records retain timestamps needed for audit and incident history.

## Migration order

1. `20260905090000_phase3_platform`
2. `20260905090500_server_remove_command`
3. `20260905091000_suspicious_login_notification`

Production must run `prisma migrate deploy`; never use `db push` against an existing environment.

