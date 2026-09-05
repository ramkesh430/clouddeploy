# Security review

## Implemented controls

- Tenant isolation through organization resolution and role enforcement on owned resources.
- Separate platform-admin guard for cross-tenant interfaces.
- Password hashing, short-lived JWTs, rotating/revocable refresh sessions, login lockout, TOTP 2FA, one-time hashed recovery codes, suspicious-IP login events and alerts.
- API keys stored as hashes, returned once, permission-scoped, plan-rate-limited, revocable, and optionally IPv4/CIDR restricted.
- AES-256-GCM for stored application and integration secrets.
- Repository path exclusion and value redaction before AI processing; only structured results and metadata persist.
- AI fixes require explicit privileged review; generated Dockerfiles never write to Git.
- Agent authentication uses hashed random credentials; disabled nodes cannot poll or heartbeat.
- Abuse mitigation supports container termination, project/user suspension, session revocation, manual review, reinstatement, and audit records.
- Health-only load-balancer configuration prevents routing to known unhealthy replicas.

## Findings requiring launch work

| Priority | Finding | Required mitigation |
| --- | --- | --- |
| Critical | The development build/runtime adapter does not provide a hardened arbitrary-code sandbox. | Run rootless workloads in isolated VMs or hardened Kubernetes nodes; enforce seccomp/AppArmor, read-only roots, capability drops, PID limits, network policy, and image scanning. |
| High | API-key rate buckets are process-local. | Move counters to Redis with atomic expiry before running more than one API instance. |
| High | Encryption key rotation has schema/architecture but no online re-encryption worker. | Add versioned ciphertext keys, dual-read migration, rotation job, and rollback procedure. |
| High | SSO/SAML and organization IP allowlists are modeled but not enforced. | Complete protocol validation, domain verification, SCIM/session rules, and middleware enforcement before sale. |
| High | Runtime outbound connection/process telemetry depends on the production agent. | Ship eBPF/runtime collectors and alert delivery before hosting untrusted public workloads. |
| High | The 2026-09-05 production dependency audit reports 20 advisories (8 high, 10 moderate, 2 low), concentrated in the current NestJS/Next.js major lines and upload/tooling transitives. | Upgrade through tested NestJS/Next.js/Multer migration branches, rerun the complete suite and penetration checks, and block public launch until high findings are resolved or formally risk-accepted. |
| Medium | IPv6 CIDR API-key restrictions are not implemented. | Add a vetted IP parser and proxy trust configuration. |
| Medium | Status and operational data need a defined retention/redaction policy. | Establish and automate per-plan retention plus privacy/deletion workflows. |

## Pre-release security gates

Threat model the control/data planes; perform dependency, secret, container, IaC, and SAST scans; commission a tenant-boundary and arbitrary-code penetration test; test backup restores; rotate all non-development keys; enforce TLS and security headers; verify proxy IP handling; and conduct an abuse-response exercise.
