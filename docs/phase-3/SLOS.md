# Service level objectives

These are the production SLOs the control plane and data plane are built against. Bind them to on-call alerts before public launch.

| Service | SLO | Window | Page when |
| --- | --- | --- | --- |
| Control-plane API (`/health`, authenticated CRUD) | 99.9% availability | 30 days | error budget < 20% remaining |
| Dashboard / login | 99.9% availability | 30 days | 5xx > 1% for 10 min |
| Deployment pipeline (queued → LIVE or FAILED) | 99% of jobs finish within 20 minutes | 7 days | p95 queue wait > 5 min |
| Managed Postgres / MySQL / MongoDB | 99.95% availability | 30 days | instance unhealthy > 2 min |
| Object storage (S3-compatible) | 99.9% availability | 30 days | 5xx > 1% |
| Custom-domain TLS issuance | 99% of verified domains reach ACTIVE SSL within 15 minutes of DNS matching | 30 days | ACME failure rate > 10% |
| Public status page | 99.95% availability, independent of the API when possible | 30 days | probe fail 2 consecutive |

Error budget: `1 - SLO`. Freeze non-SLO feature work when a 30-day budget is exhausted until the contributing class of incident is closed.

Measurement: Prometheus + Grafana already run locally (`:9090`, `:3001`). Production should scrape API `/health`, Traefik metrics, Postgres `pg_up`, and Redis `redis_up`.
