# CloudDeploy

**Deploy Your Entire Application.** Frontend, backend, database, storage, domains and SSL — all from one cloud platform.

This repository is being built incrementally, feature-by-feature, per the build order in section 149 of the product spec. It is **not** a finished commercial product yet — treat this file as the current state of truth, not the full 150-section spec.

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
- **Rollback UI**: roll back to any previous live deployment from the deployments list, with a confirmation dialog.
- **Preview deployments**: deploying a non-default branch with `environment: PREVIEW` gets its own generated preview URL, shown on the deployment detail page.
- **Billing**: real Stripe SDK integration (checkout session, customer portal, webhook handler with signature verification) that degrades gracefully with a clear error when Stripe keys aren't configured, rather than faking success — verified both the real-data paths (plans, billing summary) and the graceful-failure path.

Everything above is real, working, and connected to its actual backing service — no mocked API calls, no fake success responses. What's still simulated: actual Docker application builds and Traefik routing (the deployment pipeline runs through the same named steps and writes real logs/state, via an adapter interface designed to be swapped for a real build-worker/runtime-agent later), GitHub/Google OAuth (buttons exist; the OAuth flow itself is next), and MySQL/MariaDB provisioning (no MySQL server in the local infra stack yet — Postgres is fully real).

## What's next

See section 149 of the product spec. Immediate next slice: GitHub OAuth + repository import + framework auto-detection, then real Docker BuildKit builds in a dedicated `build-worker` process, then Traefik-driven zero-downtime deploys in a `runtime-agent` process.

## Getting started

```bash
cp .env.example apps/api/.env   # already done for local dev with dev-only secrets
npm install
npm run docker:up               # Postgres, Redis, MinIO, Traefik, registry, Prometheus, Grafana, Loki
npm run db:migrate --workspace=@clouddeploy/database
npm run db:seed --workspace=@clouddeploy/database
npm run dev                     # runs apps/api and apps/web in parallel via Turborepo
```

- API: http://localhost:4000 (Swagger at `/api/docs`, health at `/health`)
- Web: http://localhost:3000
- Seeded login: `demo@clouddeploy.dev` / `Password123!` (workspace: `acme-inc`, project: `shopfront`)

## Monorepo layout

```
apps/
  web/            Next.js frontend
  api/             NestJS control-plane API
  admin/           Super admin panel (not yet built)
  build-worker/    Dedicated build process (not yet built — simulated inside apps/api for now)
  runtime-agent/   Container/Traefik orchestration agent (not yet built)

packages/
  types/           Shared enums, DTO-adjacent interfaces, resource presets
  config/          Shared env schema (zod)
  database/        Prisma schema, generated client, seed script
  security/        Password hashing, AES-256-GCM secret encryption, API key helpers
  logger/          Structured JSON logging (pino)
  deployment-core/ Deployment pipeline step definitions shared by API + web
  docker/          Local docker-exec adapter (used for pg_dump/psql — see PostgresBackupService)
  storage/         S3-compatible storage adapter (MinIO locally, swappable to R2/S3)
  ui/ auth/ sdk/ git/ monitoring/ billing/  (reserved for later phases)

infra/
  docker/          docker-compose.yml for local dev infrastructure
  traefik/ prometheus/ grafana/ loki/ registry/ minio/
```

## Notes for continuing this build

- Follow section 150 of the product spec: build feature-by-feature, verify `tsc --noEmit` and `prisma migrate` after each module, never leave a page as a static-only placeholder without labeling it as such.
- The `RolesGuard` (`apps/api/src/auth/guards/roles.guard.ts`) is the single tenant-isolation checkpoint — every new controller route on an org-owned resource must resolve through it. It resolves the target organization from `params.organizationId`, an `x-organization-id` header, `query.organizationId`, `body.organizationId`, or by walking a resource id (`projectId`, `serviceId`, `deploymentId`, `databaseId`, `domainId`, `envVarId`, `redisInstanceId`, `bucketId`, `cronJobId`) up to its owning organization.
- **TypeScript incremental build gotcha**: each package's `tsconfig.json` has `incremental: true`, which writes a `tsconfig.tsbuildinfo` cache file. If you ever `rm -rf dist` without also removing that file, `tsc` will trust the stale cache and silently produce *no* output on the next build (exit code 0, no dist/, no error). Always run `npm run clean --workspace=@clouddeploy/<pkg>` (which removes both) rather than deleting `dist/` by hand — or `find packages apps -name tsconfig.tsbuildinfo -delete` before a from-scratch rebuild.
- Local dev ports were chosen to avoid colliding with other projects already running on this machine: Postgres 5432, Redis **6382** (not 6379), MinIO API **9002** / console **9091**, registry **5050**, Traefik **8000/8443/8090**, Grafana **3001**.
