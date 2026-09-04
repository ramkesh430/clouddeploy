# CloudDeploy

**Deploy Your Entire Application.** Frontend, backend, database, storage, domains and SSL — all from one cloud platform.

This repository is being built incrementally, feature-by-feature, per the build order below. It is **not** a finished commercial product yet — treat the "Phase 1" checklist as the current state of truth, not the full 150-section spec.

## What's implemented (Phase 1, in progress)

- **Monorepo**: npm workspaces + Turborepo, `apps/*` + `packages/*` + `infra/*`.
- **Database**: Full Prisma schema (`packages/database/prisma/schema.prisma`) covering the entire platform data model — users, orgs, projects, services, deployments, databases, domains, billing, admin, support, templates, etc. Migrated and seeded successfully against Postgres.
- **API** (`apps/api`, NestJS): JWT auth with refresh tokens + brute-force lockout, RBAC via `RolesGuard` enforcing per-organization tenant isolation on every route, organizations/workspaces + invites, projects CRUD with soft delete, services CRUD, a real BullMQ-backed deployment pipeline with a WebSocket gateway streaming live logs and status, encrypted environment variables (AES-256-GCM) with bulk `.env` import, managed database provisioning (Postgres/MySQL/MariaDB) with backups and password rotation, custom domain + simulated DNS/SSL verification, a dashboard aggregation endpoint, and `/api/docs` Swagger.
- **Web** (`apps/web`, Next.js App Router): landing page, full auth flow (login/register/forgot/reset/verify), workspace onboarding, dashboard with live stats, projects list + a working "Empty Project" deploy wizard, project detail (overview/services/deployments/environment/domains/logs/settings), a **live deployment screen** with a real WebSocket-driven terminal and progress stepper, databases page with connection-info modal, org-wide domains page, and team management. Screens not yet wired to a real backend (billing, storage, monitoring, notifications, API keys, templates) show an honest "Planned for Phase N" empty state rather than fake functionality.

Everything above is real, working, and connected — no mocked API calls. What's simulated: actual Docker builds and Traefik routing (the deployment pipeline runs through the same named steps and writes real logs/state to Postgres and over the WebSocket, via an adapter interface designed to be swapped for the real build-worker/runtime-agent later), and GitHub/Google OAuth (the buttons exist; the OAuth flow itself is Phase 2).

## What's next

See section 149 of the product spec for the full phase breakdown. Immediate next slice: GitHub OAuth + repository import + framework auto-detection, then real Docker BuildKit builds in a dedicated `build-worker` process, then Traefik-driven zero-downtime deploys in a `runtime-agent` process.

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
  ui/ auth/ sdk/ git/ docker/ monitoring/ storage/ billing/  (reserved for later phases)

infra/
  docker/          docker-compose.yml for local dev infrastructure
  traefik/ prometheus/ grafana/ loki/ registry/ minio/
```

## Notes for continuing this build

- Follow section 150 of the product spec: build feature-by-feature, verify `tsc --noEmit` and `prisma migrate` after each module, never leave a page as a static-only placeholder without labeling it as such.
- The `RolesGuard` (`apps/api/src/auth/guards/roles.guard.ts`) is the single tenant-isolation checkpoint — every new controller route on an org-owned resource must resolve through it.
- Local dev ports were chosen to avoid colliding with other projects already running on this machine: Postgres 5432, Redis **6382** (not 6379), MinIO API **9002** / console **9091**, registry **5050**, Traefik **8000/8443/8090**, Grafana **3001**.
