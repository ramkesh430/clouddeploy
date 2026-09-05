# Infrastructure requirements

## Development minimum

- Node.js 20+, npm 11+, Docker Engine with Compose.
- PostgreSQL 15+, Redis 7+, S3-compatible storage, SMTP test/relay service.
- Traefik 3, OCI registry, Prometheus, Grafana, and Loki via the existing Compose stack.
- Recommended host: 8 CPU, 16 GB RAM, and 100 GB free SSD for the complete local stack.

## Production topology

- Control plane: at least two API instances and two web instances across failure domains.
- PostgreSQL: primary plus replica, PgBouncer, encrypted volumes, point-in-time WAL archive.
- Redis: managed HA or Sentinel/cluster suitable for BullMQ; persistence and eviction policies separated from disposable cache data.
- Registry/object storage: versioning, server-side encryption, replication, lifecycle rules, and immutable backup retention.
- Per active region: two runtime nodes, two build workers, suitable database/storage nodes, private network, and independent egress controls.
- Edge: highly available Traefik or managed load balancer, health probes, DNS automation, and certificate automation.

## Required configuration groups

- Control: `DATABASE_URL`, Redis host/port, JWT signing values, encryption key, public API/web origins.
- Storage: S3 endpoint, region, access key, secret, object and backup buckets.
- Routing: `TRAEFIK_DYNAMIC_CONFIG_PATH` mounted to a watched Traefik file-provider directory.
- Integrations: GitHub OAuth/webhook, Stripe signing/API keys, SMTP, optional observability exporters.
- Agents: one-time registration token output installed as `X-Agent-Token`; rotate by registering/replacing the agent record.

Store production configuration in a secret manager. Do not put secrets into container images, repository snapshots, build arguments, or AI payloads.

## Network policy

Only edge traffic reaches workloads. Control-plane services communicate over private networks. Database, Redis, storage, and agent endpoints reject public ingress. Build workers have restricted egress and no access to control-plane credentials. Outbound workload traffic should pass through an observable egress gateway to support abuse detection.

