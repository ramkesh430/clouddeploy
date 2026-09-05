# CloudDeploy

**Deploy Your Entire Application.** Frontend, backend, database, storage, domains and SSL — all from one cloud platform.

This repository is built incrementally. Phase 1, Phase 2, and the Phase 3 control-plane/product surfaces are implemented; the hardened arbitrary-code data plane remains a launch gate. Treat this file and the [Phase 3 readiness checklist](docs/phase-3/LAUNCH_READINESS.md) as the current state of truth.

## What's implemented

### Phase 1 — Authentication, Organization, Projects, Deployments, Domains, Environment Variables

- **Monorepo**: npm workspaces + Turborepo, `apps/*` + `packages/*` + `infra/*`.
- **Database**: Full Prisma schema (`packages/database/prisma/schema.prisma`) covering the entire platform data model — users, orgs, projects, services, deployments, databases, domains, billing, admin, support, templates, etc.
- **API**: JWT auth with refresh tokens + brute-force lockout, RBAC via `RolesGuard` enforcing per-organization tenant isolation on every route, workspaces + invites, projects/services CRUD with soft delete, a BullMQ-backed deployment pipeline with a WebSocket gateway streaming live logs, encrypted environment variables (AES-256-GCM) with bulk `.env` import, custom domains with simulated DNS/SSL verification, a dashboard aggregation endpoint, `/api/docs` Swagger.
- **Web**: landing page, full auth flow, workspace onboarding, dashboard, a working "create project → add services → deploy" wizard, project detail tabs, and a **live deployment screen** with a real WebSocket-driven terminal and progress stepper.

### Phase 2 — Redis, Backups, Storage, Database Manager, Workers, Cron Jobs, Rollback, Preview Deployments, Billing

- **Real PostgreSQL provisioning**: creating a Postgres database actually runs `CREATE ROLE` / `CREATE DATABASE` against the shared local Postgres server (`PostgresAdminService`) — logically isolated per tenant (separate database + role), which Postgres enforces natively (a tenant's connection cannot see another tenant's database at all). This is the MVP fidelity level the spec calls for in section 6; full container-per-tenant isolation is future, Kubernetes-ready architecture.
- **Real SQL editor + table browser**: every query runs through a connection pool authenticated *as the tenant's own role*, not an admin connection — isolation comes from Postgres itself, not application-level filtering. Backed by Monaco in the UI.
- **Real backups**: `pg_dump`/`psql` shelled out inside the running Postgres container (via `packages/docker`'s exec adapter, since the API host doesn't have Postgres client tools installed) and stored compressed in the S3-compatible backups bucket. Restore is a real drop-and-restore, verified end-to-end (including that ownership/grants survive the round trip).
- **Real Redis provisioning**: each Redis "instance" is a Redis 6+ ACL user on the one shared Redis server, scoped to its own key prefix (`~<user>:*`) — verified that cross-tenant key access is actually denied by Redis, not just hidden in the UI.
- **Real object storage**: buckets map 1:1 to real MinIO/S3 buckets via `packages/storage`'s S3Adapter (swappable to Cloudflare R2 or real S3 by changing the endpoint). Upload, folder navigation, and presigned download URLs all verified against real files.
- **Real cron scheduling**: BullMQ Job Schedulers (not `setInterval`) drive cron jobs on their actual cron expression; command *execution* is simulated (real arbitrary command execution belongs on an isolated runtime node, never the control plane — see section 91 on build sandboxing).
- **Real rollback**: rolling back reuses the target deployment's already-built Docker image (`dockerImageTag`/`registryPath`) instead of rebuilding — the deployment pipeline detects a pre-populated `SUCCEEDED` Build row and skips straight past the clone/build/image steps to "Start Containers", verified end-to-end.
- **Preview deployments**: driven by real GitHub pull-request webhooks (opened → deploy, synchronize → redeploy, closed → teardown) rather than just branch naming, with each PR getting its own preview URL and a configurable teardown delay (`PREVIEW_CLEANUP_DELAY_MS`, default 30 min) scheduled as a real BullMQ delayed job — verified by inspecting the job in Redis and by forcing a short delay to observe real teardown.
- **Billing**: real Stripe SDK integration (checkout session, customer portal, webhook handler with signature verification) that degrades gracefully with a clear error when Stripe keys aren't configured, rather than faking success — verified both the real-data paths (plans, billing summary) and the graceful-failure path.

### Phase 2 (continued) — Team permissions, billing enforcement, API keys, webhooks, notifications, alerting, activity log

- **Project-level access (RBAC)**: DEVELOPER/VIEWER organization members only see projects they created or were explicitly granted (`ProjectMember`) — enforced in both the project list *and* `GET /projects/:id` (a direct-by-id request for a project you have no grant to returns 404, not a leaked 200). OWNER/ADMIN still see everything. `POST/GET/DELETE /projects/:projectId/members` manages grants; `PATCH /organizations/:organizationId/members/:memberId/role` changes an org-wide role.
- **Plan limits, actually enforced**: creating a project, database, or inviting a team member checks the org's real usage against its plan's real limits (`UsageService.checkLimit`) — a Free-tier org genuinely cannot create a 2nd project or invite a 2nd member; upgrading (a real `Subscription` row pointing at a paid `Plan`) genuinely lifts the limit. `GET /usage` reports live usage (project/database/team-member counts, RAM, storage) against the plan's limits.
- **API keys**: `cd_`-prefixed keys, shown once at creation (only the hash is stored), authenticate via a new `AnyAuthGuard` that accepts either a JWT or an API key on the same routes — verified an API key can call an org-scoped endpoint exactly like a logged-in user, scoped to its stored permissions.
- **Webhooks**: real outgoing HTTP deliveries, HMAC-SHA256 signed (`X-CloudDeploy-Signature`) over the exact JSON body sent, with automatic BullMQ retry (3 attempts, exponential backoff) and a `WebhookDelivery` row per attempt — verified against a real local HTTP receiver, including independently recomputing the signature from the stored secret to confirm it's cryptographically valid, not just present.
- **Notifications**: in-app (bell/list/unread count/mark-read) and real email, sent over real SMTP to a local Mailpit container (`infra/docker/docker-compose.yml`, web UI at `:8025`) — each channel has its own per-notification-type preference (`NotificationPreference`), verified independently: disabling email for a type suppresses the email while the in-app notification still fires.
- **Alerting + real metrics**: threshold alert rules (`AlertRule`) evaluated every 60s by a BullMQ Job Scheduler against **real, live** values — `pg_stat_activity` connection count / `pg_database_size` for databases, real `SCAN`+`INFO memory` for Redis — and fire a notification + signed webhook the first time a rule breaches, then respect `cooldownMinutes` before firing again (verified against real BullMQ tick timing, not a mocked clock).
- **Database Users & Connections**: `POST /databases/:id/users` provisions a real, additional Postgres role scoped to that database (readonly or readwrite), with correct privileges on both existing tables *and* tables created afterward (`ALTER DEFAULT PRIVILEGES FOR ROLE <owner>`, including sequence `USAGE` for `serial`/`INSERT`) — verified by connecting as the new role directly and confirming Postgres itself enforces the boundary. `GET /databases/:id/connections` lists real, current `pg_stat_activity` sessions.
- **Metric retention**: raw per-service metric samples roll up into hourly buckets after 1 hour, hourly buckets fold into daily buckets after 30 days, with raw pruned after 24h and hourly pruned after 30 days — real aggregate SQL, verified by inserting real samples at controlled timestamps and hand-checking the resulting avg/max math and pruning boundaries. (No metrics *collector* is wired up yet in this MVP — see "What's next".)
- **Activity log**: `member.invited`, `member.role_changed`, `api_key.created`, `webhook.created`, `deployment.rollback`, `database.backup_restored`, `subscription.changed`, and `storage.object_deleted` are all recorded to a shared `ActivityLogService`, readable via `GET /organizations/:organizationId/activity-logs`.

### GitHub OAuth, repository import, and real framework auto-detection

- **Real GitHub OAuth**: the full Authorization Code flow against GitHub's actual endpoints (`GithubOAuthService`) — signed, short-lived `state` param (HMAC, not a DB session, since the browser lands on the public callback with no bearer token available), token exchange, connection storage encrypted the same way as database credentials. Degrades gracefully with a clear error when `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` aren't configured, exactly like the Stripe billing integration.
- **Real framework detection**: `detectRepositoryStack` (`packages/deployment-core`) is a pure function — given a repo's file tree and manifest contents, it works out what to deploy, with Docker as the universal fallback per the spec. It's unit-tested (`detection.spec.ts`) and was also verified live against real public GitHub repositories (no OAuth needed for public repos, which is what makes that possible): correctly picked out Laravel + MySQL from `laravel/laravel` (and correctly suppressed the co-located `package.json`'s Vite tooling as a false "second service"), correctly found two separate Next.js deploy roots in the `vercel/next-learn` monorepo, and correctly deferred to Docker when a Dockerfile is present.
- **A public-repo fast path**: pasting any public GitHub URL detects and pre-fills the deploy wizard with zero GitHub connection required (`GET /github/public-detect`) — useful both as a real product feature and as how this was tested without a registered OAuth app.
- **Auto-deploy on push**: a real webhook receiver with HMAC-SHA256 signature verification (`X-Hub-Signature-256`), wired to install itself on import when `GITHUB_WEBHOOK_SECRET` is set.
- The deploy wizard (`/projects/new/empty`) now accepts a detected repository and pre-fills project name, services (with real build/start commands and root directories), and offers to provision the *actually recommended* database/Redis via the real Phase 2 provisioning — "Deploy Full Stack" from a real repo now really does deploy the full stack it detected.

### Phase 3 — AI assistance, commercial operations, regions, scaling, admin, API, SDK, and CLI

- **Safe AI deployment assistance**: structured repository analysis, environment/dependency/resource recommendations, deployment architecture explanations, log root-cause analysis, review-required typed fixes, and Dockerfile generation. Secret-bearing files are discarded, remaining text is redacted, and raw input is not persisted.
- **Templates marketplace**: categorized definitions for Next.js, React + Node, MERN, Laravel, Django, WordPress, n8n, Strapi, Ghost, Directus, Metabase, Grafana, and Uptime Kuma. Definitions support multiple services, managed data/cache/storage, ports, variables, volumes, health checks, domains, and resource estimates.
- **Agency and white label**: client/project economics, health dashboard, portal grants, branding, accent/logo/domain/support/login settings, and strict tenant-safe client projections.
- **Regional infrastructure**: Singapore, Mumbai, Dubai, Frankfurt, Virginia and extensible regions; typed build/runtime/database/storage nodes; authenticated agent heartbeats/commands; same-region placement and cross-region warnings.
- **Autoscaling and routing**: CPU/RAM/request rules with min/max and cooldowns, replica reconciliation and history, plus Traefik output containing only healthy running replicas.
- **Operations**: separate `/admin` console for commercial, tenant, workload, capacity, server, support, abuse, status, analytics, logs, and security workflows. Server actions include drain, maintenance, restart-agent, disable, and reviewed removal.
- **Support, trust, and status**: customer/admin ticket conversations, abuse reports and risk events, container/project/user suspension workflows, and a live public `/status` page with published incident updates.
- **Security**: TOTP 2FA, one-time recovery codes, suspicious-login events, session revocation, API-key IP restrictions, secret-access audit schema, and SSO/enterprise-ready data models.
- **Developer platform**: versioned `/api/v1`, plan-aware scoped API keys, `@clouddeploy/sdk`, and a `clouddeploy` CLI supporting auth, projects, deploy, logs, env, domains, databases, and rollback.
- **Operating documentation**: [architecture](docs/phase-3/ARCHITECTURE.md), [schema](docs/phase-3/DATABASE_SCHEMA.md), [API](docs/phase-3/API.md), [infrastructure](docs/phase-3/INFRASTRUCTURE.md), [security](docs/phase-3/SECURITY_REVIEW.md), [scaling](docs/phase-3/SCALING.md), [production](docs/phase-3/PRODUCTION_DEPLOYMENT.md), [disaster recovery](docs/phase-3/DISASTER_RECOVERY.md), and [known limitations](docs/phase-3/KNOWN_LIMITATIONS.md).

The Phase 1/2 backing services described above are real. Phase 3's control-plane state machines and product/API surfaces are working, while local arbitrary application builds and runtime containers still use the simulation adapter; the production worker/agent sandbox, telemetry collector, and edge deployment are explicit launch gates. MySQL/MariaDB and MongoDB provider provisioning also require production providers; PostgreSQL is fully implemented locally. See [known limitations](docs/phase-3/KNOWN_LIMITATIONS.md).

## What's next

The immediate launch slice is the hardened BuildKit worker/runtime agent, production telemetry/abuse collectors, Redis-backed distributed rate limiting, and production-equivalent acceptance/load/security testing. The readiness checklist tracks the exact gates.

## Getting started

```bash
cp .env.example apps/api/.env   # already done for local dev with dev-only secrets
npm install
npm run docker:up               # Postgres, Redis, MinIO, Mailpit, Traefik, registry, Prometheus, Grafana, Loki
npm run db:migrate --workspace=@clouddeploy/database
npm run db:seed --workspace=@clouddeploy/database
npm run dev                     # runs apps/api and apps/web in parallel via Turborepo
```

- API: http://localhost:4000 (Swagger at `/api/docs`, health at `/health`)
- Web: http://localhost:3000
- Seeded login: `demo@clouddeploy.dev` / `Password123!` (workspace: `acme-inc`, project: `shopfront`)
- Try the deploy wizard right away with **no GitHub account needed**: Create Project → Import GitHub Repository → "Deploy a public repository" → paste any public repo URL (e.g. `laravel/laravel` or `vercel/next-learn`).
- To exercise the real GitHub OAuth connection (not required for the above), register a GitHub OAuth App with callback URL `http://localhost:4000/api/v1/github/callback` and set `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` in `apps/api/.env`; add `GITHUB_WEBHOOK_SECRET` too if you want auto-deploy-on-push against a real repo.

## Monorepo layout

```
apps/
  web/            Next.js frontend
  api/             NestJS control-plane API
                   (the separate super-admin route tree lives in apps/web/src/app/admin)
  build-worker/    Dedicated build process (not yet built — simulated inside apps/api for now)
  runtime-agent/   Container/Traefik orchestration agent (not yet built)

packages/
  types/           Shared enums, DTO-adjacent interfaces, resource presets
  config/          Shared env schema (zod)
  database/        Prisma schema, generated client, seed script
  security/        Password hashing, AES-256-GCM secret encryption, API key helpers
  logger/          Structured JSON logging (pino)
  deployment-core/ Deployment pipeline steps + the pure repository-stack detector (detection.ts), shared by API + web
  docker/          Local docker-exec adapter (used for pg_dump/psql — see PostgresBackupService)
  storage/         S3-compatible storage adapter (MinIO locally, swappable to R2/S3)
  sdk/             Official TypeScript public API client
  cli/             clouddeploy command-line client

infra/
  docker/          docker-compose.yml for local dev infrastructure (Postgres, Redis, MinIO, Mailpit, Traefik, registry, Prometheus, Grafana, Loki)
  traefik/ prometheus/ grafana/ loki/ registry/ minio/
```

## Notes for continuing this build

- Follow section 150 of the product spec: build feature-by-feature, verify `tsc --noEmit` and `prisma migrate` after each module, never leave a page as a static-only placeholder without labeling it as such.
- The `RolesGuard` (`apps/api/src/auth/guards/roles.guard.ts`) is the single tenant-isolation checkpoint — every new controller route on an org-owned resource must resolve through it. It resolves the target organization from `params.organizationId`, an `x-organization-id` header, `query.organizationId`, `body.organizationId`, or by walking a resource id (`projectId`, `serviceId`, `deploymentId`, `databaseId`, `domainId`, `envVarId`, `redisInstanceId`, `bucketId`, `cronJobId`, `connectionId`, `alertRuleId`, `apiKeyId`, `webhookId`) up to its owning organization. `AnyAuthGuard` (dual JWT/API-key auth) composes with it the same way `JwtAuthGuard` does — see `ProjectsController` for the pattern.
- **TypeScript incremental build gotcha**: each package's `tsconfig.json` has `incremental: true`, which writes a `tsconfig.tsbuildinfo` cache file. If you ever `rm -rf dist` without also removing that file, `tsc` will trust the stale cache and silently produce *no* output on the next build (exit code 0, no dist/, no error). Always run `npm run clean --workspace=@clouddeploy/<pkg>` (which removes both) rather than deleting `dist/` by hand — or `find packages apps -name tsconfig.tsbuildinfo -delete` before a from-scratch rebuild.
- **Cross-package imports inside `packages/*` need `"paths": {}`**: the root `tsconfig.base.json`'s `paths` map every `@clouddeploy/*` name to its sibling package's TS *source* — right for `apps/*` (editor convenience; `tsc --noEmit` there tolerates the resulting nested output), wrong for a `packages/*` package that itself imports another package (as `deployment-core` does with `types`), because it collides with that package's own `rootDir` and `tsc` fails outright (or, worse, silently produces no output). Any `packages/*/tsconfig.json` that imports another `@clouddeploy/*` package overrides `"paths": {}` so the import resolves normally through `node_modules` -> that package's built `dist/` instead. See `packages/deployment-core/tsconfig.json`.
- Local dev ports were chosen to avoid colliding with other projects already running on this machine: Postgres 5432, Redis **6382** (not 6379), MinIO API **9002** / console **9091**, Mailpit SMTP **1025** / web UI **8025**, registry **5050**, Traefik **8000/8443/8090**, Grafana **3001**.
