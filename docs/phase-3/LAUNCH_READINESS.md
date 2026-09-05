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

- [ ] Ship and independently review hardened build-worker and runtime-agent executors.
- [ ] Execute template stacks end-to-end on production-equivalent runtime nodes.
- [ ] Move rate limiting/locks to HA Redis and load-test multiple API instances.
- [ ] Add runtime process/network/egress telemetry and automated risk rules.
- [ ] Complete image/dependency scanning and signature verification.
- [ ] Complete encryption-key rotation worker and recovery drill.
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

