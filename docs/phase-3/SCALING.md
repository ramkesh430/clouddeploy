# Scaling recommendations

## Scheduling and autoscaling

Keep application, database, Redis, and object-storage access in one region unless the user explicitly accepts latency and egress warnings. Maintain at least two runtime nodes per region and leave 25–30% CPU/RAM headroom for rescheduling.

Autoscaling evaluates CPU, memory, and requests against minimum/maximum replicas and separate scale-up/down cooldowns. Production metrics should be rolling windows, not single samples. Start with a fast 60–120 second scale-up cooldown and a conservative 300–600 second scale-down cooldown. Never scale below one healthy replica for an active service.

## Control plane

- Keep API instances stateless; put API-key limits, locks, and short-lived cache entries in HA Redis.
- Use PgBouncer transaction pooling and cap every application pool.
- Add read replicas for admin analytics/status history before moving transactional reads indiscriminately.
- Pre-aggregate metrics and business analytics; partition large logs/metrics by time.
- Use cursor pagination for events, deployments, logs, tickets, risk data, and admin lists.

## Data and logs

Retain raw service metrics briefly, hourly data for 30 days, and daily aggregates according to plan. Stream logs to Loki/object storage, index only required labels, and enforce organization/plan retention. Put immutable backups in a separate account/bucket and continuously test restore integrity.

## Capacity triggers

- Add runtime capacity when projected peak use exceeds 70% of allocatable CPU or RAM.
- Add build capacity when queue wait exceeds the product SLO for two evaluation windows.
- Add database capacity before storage reaches 70% or sustained CPU/connection use reaches 75%.
- Add storage capacity before replication-safe free space falls below 30%.
- Split regional control-plane queues when one region can delay work in another.

