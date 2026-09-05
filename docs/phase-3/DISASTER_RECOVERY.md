# Disaster recovery runbook

## Targets

Set contractual RPO/RTO per plan. A reasonable starting target is control-plane RPO 5 minutes/RTO 60 minutes and customer database targets based on the purchased backup tier. Validate targets through scheduled exercises.

## Control-plane restore

Provision clean API/web/worker infrastructure from versioned IaC, restore PostgreSQL to the selected PITR point, restore Redis only when required for durable queue recovery, deploy the matching application image, run migration status checks, and reconcile queued/running operations before reopening writes.

## Managed database restore

Quiesce writes, verify the backup checksum and tenant/database identity, restore into a new database first, run integrity checks, rotate credentials, switch the connection atomically, and retain the prior database until the observation window ends.

## Registry recovery

Restore manifests/blobs from replicated object storage or rebuild from signed source commits and locked dependencies. Verify image digests/signatures before scheduling. Mark deployments whose exact image cannot be recovered and do not substitute an unverified tag.

## Storage recovery

Restore versioned objects to a new bucket/account, validate inventory and checksums, then update the control-plane endpoint. Preserve tenant prefixes and access boundaries. Test presigned URL and backup access afterward.

## Region failure

Declare an incident, stop new placement into the failed region, mark its nodes offline, determine dependency availability, and fail over only projects with replicated data or explicit disaster-recovery configuration. DNS/edge switching must not point applications at stale or unavailable databases.

## Node replacement

Drain when reachable; otherwise mark offline, remove it from Traefik, reconcile replicas elsewhere, revoke/replace the agent credential, rebuild from immutable infrastructure, register as a new node, and verify health before restoring capacity.

Record timestamps, decisions, customer impact, validation evidence, and follow-up work in the incident timeline.

