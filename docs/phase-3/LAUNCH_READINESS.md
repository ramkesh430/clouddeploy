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

- [ ] Ship and independently review a hardened build-worker executor and a production runtime-agent binary that actually launches user workloads (see `apps/runtime-agent`'s own telemetry-only scope below).
- [ ] Execute template stacks end-to-end on production-equivalent runtime nodes.
- [x] Move API-key rate limiting to Redis, shared across every API process (fixed-window INCR/EXPIRE, fails open on a Redis outage). Locks/queues beyond rate limiting still need the same HA review before multi-instance load testing.
- [x] Runtime process/network/egress telemetry and automated risk rules: `apps/runtime-agent` is a real agent that authenticates with the existing per-server token, discovers Docker containers on its host by the `com.clouddeploy.container-id` label, and reports real `docker stats`/`docker top`/`/proc/net/tcp` samples on every heartbeat. `InfrastructureService.processTelemetry` runs those samples through `detectContainerRisks` (`@clouddeploy/deployment-core`, 12 unit tests) and persists `RiskEvent` rows (CPU/RAM abuse, known miner processes, suspicious command lines, mining-pool/high-fan-out egress, port-scanning port fan-out), deduplicated per container+type for 30 minutes. Verified live: launched a real container with a genuine CPU-pinning process named `xmrig`, ran the built agent binary against the running API, and confirmed real `CPU_ABUSE`/`CRYPTO_MINING` `RiskEvent` rows appeared via `GET /admin/abuse/risk-events` and were dismissable through the existing admin action endpoint. Still outstanding: nothing yet labels real *user* containers with `com.clouddeploy.container-id` (deployments are still the Phase 2 simulation adapter — see above), so this pipeline has no live production traffic until that lands; BRUTE_FORCE/SPAM/MALWARE/PHISHING remain unimplemented since they need application-log and content signals this agent doesn't collect.
- [ ] Complete image/dependency scanning and signature verification.
- [x] Encryption-key rotation worker: `POST /admin/security/rotate-encryption-key` re-encrypts every at-rest secret (env vars, database/Redis passwords, GitHub tokens, 2FA secrets, the dormant secrets vault) under `ENCRYPTION_KEY`, with `decryptSecretWithFallback` keeping reads working against not-yet-rotated rows during the transition (`ENCRYPTION_KEY_PREVIOUS`). Verified live: rotated a real key, confirmed zero-downtime reads mid-rotation, and confirmed data still decrypts with the previous key removed entirely. A full recovery drill (simulated key loss, restore procedure) is still outstanding.
- [ ] Commission tenant isolation and arbitrary-code penetration tests.
- [ ] Validate PostgreSQL, registry, storage, and full-region recovery exercises.
- [ ] Define SLOs/on-call/escalation, support coverage, abuse policy, privacy terms, and data retention.
- [ ] Configure production DNS for `status.clouddeploy.app` and an independent status delivery path.
- [ ] Resolve production dependency-audit findings or record approved exceptions.

## Commercial operations

- [ ] Confirm Stripe production products, tax, invoices, refunds, and dunning.
- [ ] Confirm plan entitlements, API ceilings, support SLAs, and overage behavior.
- [ ] Publish API/SDK/CLI versioning and deprecation policy.
- [ ] Prepare customer migration/offboarding and data-export procedures.
- [ ] Train support/abuse reviewers and run tabletop incidents.

Current verdict: suitable for continued staging and controlled internal pilots. Public commercial hosting of arbitrary user code should remain gated on the hardened data-plane and security items above.

