# Commercial launch readiness checklist

## Product and acceptance

- [x] Structured repository analysis with secret redaction.
- [x] Deployment-log root-cause analysis and review-required safe fixes.
- [x] Reviewable Dockerfile generation without Git writes.
- [x] Resource and deployment-architecture recommendations.
- [x] Marketplace catalog and multi-service one-click definition/deploy flow.
- [x] Agency clients, economics dashboard, portal grants, and branding settings.
- [x] Region selection, regional node models, same-region scheduler, dependency warnings.
- [x] Cooldown-aware horizontal autoscaling and replica reconciliation.
- [x] Health-filtered Traefik backend generation.
- [x] Super-admin dashboard, resources, infrastructure actions, support, abuse, status, analytics, and security views.
- [x] Support conversation and incident publication workflows.
- [x] Abuse risk review, project/container/user suspension APIs, reinstatement, session revocation, audit.
- [x] Versioned API, key scopes/IP restrictions/plan ceiling, SDK, and CLI.
- [x] Public live status page and incident history.
- [x] 2FA/recovery codes/suspicious-login events and enterprise-ready schema.
- [x] Phase 1/2 type compatibility and regression suite.

## Required before hosting untrusted production code

- [x] Dedicated `apps/build-worker` process plus in-API `ImageBuildService` using the same sandbox: BuildKit, non-root generated Dockerfiles, `--cap-drop ALL`, `--security-opt no-new-privileges`, pids/memory/cpu limits, no docker.sock on tenant containers. Isolation is Docker namespaces/cgroups (not gVisor/Firecracker); that is the production sandbox for this architecture.
- [x] Runtime starts only HMAC-signed, digest-pinned images (`ContainerRuntimeService` verifies `imageSignature` against `ENCRYPTION_KEY` and refuses digest drift). Template/rollback deploys reuse the stored digest/signature.
- [ ] Execute template stacks end-to-end on production-equivalent runtime nodes.
- [x] Move API-key rate limiting to Redis, shared across every API process (fixed-window INCR/EXPIRE, fails open on a Redis outage). Locks/queues beyond rate limiting still need the same HA review before multi-instance load testing.
- [x] Runtime process/network/egress telemetry and automated risk rules: `apps/runtime-agent` is a real agent that authenticates with the existing per-server token, discovers Docker containers on its host by the `com.clouddeploy.container-id` label, and reports real `docker stats`/`docker top`/`/proc/net/tcp` samples on every heartbeat. `InfrastructureService.processTelemetry` runs those samples through `detectContainerRisks` (`@clouddeploy/deployment-core`, 12 unit tests) and persists `RiskEvent` rows (CPU/RAM abuse, known miner processes, suspicious command lines, mining-pool/high-fan-out egress, port-scanning port fan-out), deduplicated per container+type for 30 minutes. Verified live: launched a real container with a genuine CPU-pinning process named `xmrig`, ran the built agent binary against the running API, and confirmed real `CPU_ABUSE`/`CRYPTO_MINING` `RiskEvent` rows appeared via `GET /admin/abuse/risk-events` and were dismissable through the existing admin action endpoint. `ContainerRuntimeService.startContainer` now labels every real app container with `com.clouddeploy.container-id=<platform Container.id>` (row is created first, then `docker run`), so live deploy traffic is visible to the agent. BRUTE_FORCE/SPAM/MALWARE/PHISHING remain unimplemented since they need application-log and content signals this agent doesn't collect.
- [x] Image scanning + signature verification: local policy scan (non-root USER, sha256 digest) always; Trivy CRITICAL/HIGH via `aquasec/trivy` (required when `NODE_ENV=production` or `TRIVY_REQUIRED=true`); HMAC-SHA256 of the digest stored on `builds`/`services` and verified immediately before `docker run`.
- [x] Encryption-key rotation worker: `POST /admin/security/rotate-encryption-key` re-encrypts every at-rest secret (env vars, database/Redis passwords, GitHub tokens, 2FA secrets, the dormant secrets vault) under `ENCRYPTION_KEY`, with `decryptSecretWithFallback` keeping reads working against not-yet-rotated rows during the transition (`ENCRYPTION_KEY_PREVIOUS`). Verified live: rotated a real key, confirmed zero-downtime reads mid-rotation, and confirmed data still decrypts with the previous key removed entirely. A full recovery drill (simulated key loss, restore procedure) is still outstanding.
- [ ] Commission an independent tenant-isolation and arbitrary-code penetration test (internal procedure: `docs/phase-3/SECURITY_TESTING.md`).
- [x] Local/staging recovery drill script: `scripts/disaster-recovery-drill.sh` (Postgres dump + restore into a throwaway database, Redis snapshot, API health). Full-region production failover still needs a scheduled exercise.
- [x] SLOs documented in `docs/phase-3/SLOS.md`. On-call/escalation, support coverage, abuse policy, privacy terms, and data retention still need legal/ops sign-off.
- [x] Status page is live at `/status`; Traefik file route for `status.clouddeploy.local` is in `infra/traefik/dynamic/status.json`. Production DNS for `status.clouddeploy.app` remains an operator step.
- [ ] Resolve production dependency-audit findings or record approved exceptions.

## Commercial operations

- [x] Stripe webhook handles checkout, subscription update/delete, invoice paid, and invoice.payment_failed → `PAST_DUE` (dunning). Production boot (`NODE_ENV=production`) refuses to start without `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. Live products/tax/refunds still need a Stripe Dashboard configuration.
- [ ] Confirm plan entitlements, API ceilings, support SLAs, and overage behavior.
- [ ] Publish API/SDK/CLI versioning and deprecation policy.
- [ ] Prepare customer migration/offboarding and data-export procedures.
- [ ] Train support/abuse reviewers and run tabletop incidents.

Current verdict: the local/pilot data plane is real (sandboxed Docker build+run, labeled telemetry, digest signatures, Traefik ACME issuance, Postgres/MySQL/Mongo). Public commercial hosting of arbitrary user code still needs an independent pentest, production DNS/port 80 for Let's Encrypt, live Stripe products, and a scheduled multi-region DR exercise.

