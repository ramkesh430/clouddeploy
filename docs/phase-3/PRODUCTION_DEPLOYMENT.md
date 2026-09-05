# Production deployment guide

## 1. Provision dependencies

Create PostgreSQL with replica and PITR, HA Redis, encrypted object storage, registry, SMTP, DNS/SSL provider, observability, and at least two runtime/build nodes per launch region. Establish private network routes and deny public data-service ingress.

## 2. Configure secrets

Generate unique JWT and encryption keys; store them and all integration credentials in a secret manager. Configure allowed web/API origins, trusted proxies, storage/registry endpoints, Stripe/GitHub webhook secrets, and the watched Traefik dynamic-config mount. Never reuse the development `.env` values.

## 3. Release the control plane

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run migrate:deploy --workspace=@clouddeploy/database
npm run seed --workspace=@clouddeploy/database
```

Deploy the API first with readiness probes for PostgreSQL/Redis/storage/queue, then workers, then web. Run migrations as a single release job. Do not run multiple seed jobs concurrently.

## 4. Register regional agents

Create each server from the super-admin region/server interfaces, capture its one-time token, and inject it into the matching agent. Verify a heartbeat, fresh metrics, and command round trip. Drain one node and prove workloads reschedule before accepting traffic.

## 5. Configure edge traffic

Mount `TRAEFIK_DYNAMIC_CONFIG_PATH`, enable the file provider, and verify only healthy private replica addresses appear. Configure TLS, DNS, forwarded-header trust, WebSocket support for live logs, and an edge health check.

## 6. Launch verification

Run the acceptance flow in a disposable tenant: repository analysis, template deploy, regional database/Redis/storage, failed-build diagnosis and reviewed fix, autoscale up/down, unhealthy replica exclusion, backup/restore, CLI deploy/logs, API permission/rate-limit checks, support response, abuse suspension/reinstatement, and incident publish/resolve.

## 7. Rollback

Application releases roll back to the prior immutable image. Database schema rollback must use a tested forward-fix migration unless a release-specific reverse migration and restore point were approved. Preserve audit/incident records during rollback.

