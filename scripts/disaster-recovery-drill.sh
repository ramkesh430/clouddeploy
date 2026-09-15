#!/usr/bin/env bash
# Control-plane disaster-recovery smoke drill for local/staging.
# Does not mutate production. Exits non-zero if a restore ingredient is missing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${ROOT}/.dr-drill-${STAMP}"
mkdir -p "$OUT"

echo "== PostgreSQL dump =="
docker exec clouddeploy-postgres-1 pg_dump -U clouddeploy -d clouddeploy --format=custom --file="/tmp/clouddeploy-${STAMP}.dump"
docker cp "clouddeploy-postgres-1:/tmp/clouddeploy-${STAMP}.dump" "$OUT/postgres.dump"
ls -lh "$OUT/postgres.dump"

echo "== Redis snapshot =="
docker exec clouddeploy-redis-1 redis-cli SAVE >/dev/null
docker cp clouddeploy-redis-1:/data/dump.rdb "$OUT/redis.rdb" 2>/dev/null || echo "(no dump.rdb — AOF-only is fine)"

echo "== Restore check (separate database, not in-place) =="
docker exec clouddeploy-postgres-1 psql -U clouddeploy -d postgres -c "DROP DATABASE IF EXISTS clouddeploy_drill;"
docker exec clouddeploy-postgres-1 psql -U clouddeploy -d postgres -c "CREATE DATABASE clouddeploy_drill;"
docker exec clouddeploy-postgres-1 pg_restore -U clouddeploy -d clouddeploy_drill --exit-on-error "/tmp/clouddeploy-${STAMP}.dump"
docker exec clouddeploy-postgres-1 psql -U clouddeploy -d clouddeploy_drill -c "SELECT count(*) AS users FROM users;"
docker exec clouddeploy-postgres-1 psql -U clouddeploy -d postgres -c "DROP DATABASE clouddeploy_drill;"

echo "== API health after drill =="
curl -fsS http://localhost:4000/health

echo "Drill artifacts in $OUT"
echo "DONE"
