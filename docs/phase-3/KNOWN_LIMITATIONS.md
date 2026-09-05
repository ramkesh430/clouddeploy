# Known limitations

- The repository/log analysis engine is deterministic and vendor-neutral. It implements structured analysis and safety boundaries but is not connected to a hosted LLM. A production provider adapter should use structured outputs and the same redaction boundary.
- Local application builds and runtime containers still use the Phase 2 simulation adapter. Regional placement, server commands, replicas, autoscaling decisions, and Traefik generation are implemented in the control plane; a hardened production build-worker/runtime-agent binary is still required to execute arbitrary workloads.
- MySQL/MariaDB are represented but only PostgreSQL provisioning is fully implemented in the current local infrastructure. Templates requiring MySQL or MongoDB need the corresponding production provider.
- API-key limits are held in memory per API process. They must move to Redis for a horizontally scaled control plane.
- Traefik configuration is written only when `TRAEFIK_DYNAMIC_CONFIG_PATH` is configured; dynamic provider reload and edge deployment remain operator responsibilities.
- SSO/SAML, SCIM, organization IP allowlists, dedicated nodes/databases, private networking, SLA, custom retention, audit export, and encryption-key rotation are modeled as enterprise architecture but are not complete customer-facing products.
- Client portal permissions and white-label settings are modeled and administered, but a separately hosted custom-domain client portal/login experience is future work.
- CPU/RAM/request autoscaling depends on recent service metrics. Production agents must supply trusted metrics and request-rate telemetry.
- Outbound network/process abuse signals are accepted and actionable as `RiskEvent` records; automated eBPF/process/network collection remains agent work.
- The public status page is implemented at `/status`; serving it from `status.clouddeploy.app` requires DNS and edge routing configuration.
- Template definitions can describe volumes and health checks, but production enforcement depends on the runtime provider.

