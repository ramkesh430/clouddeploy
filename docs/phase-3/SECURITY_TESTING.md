# Security testing (pre-production)

This is the mandatory smoke + isolation pass before hosting untrusted code. It does not replace an independent penetration test.

## 1. Container sandbox

```bash
# Every CloudDeploy-managed container must carry the platform id label
docker ps --filter label=com.clouddeploy.container-id --format '{{.ID}} {{.Labels}}'

# No tenant container may see the Docker socket
docker inspect $(docker ps -q --filter label=com.clouddeploy.container-id) \
  --format '{{.Name}} {{json .Mounts}} {{json .HostConfig.CapDrop}} {{json .HostConfig.SecurityOpt}}'
```

Expect: `CapDrop` includes `ALL`, `SecurityOpt` includes `no-new-privileges:true`, mounts do not include `docker.sock`.

## 2. Image integrity

A real deploy records `imageDigest` + `imageSignature` on `builds` and `services`. Runtime refuses a retagged image. Tamper check:

```bash
# After a real build, retagging under the same name must fail at start
docker tag alpine:latest clouddeploy/some-service:abc1234
# Next reconcile should throw "Image digest drifted" or "Image signature mismatch"
```

## 3. Tenant database isolation

- Postgres: connect as tenant A and `SELECT` from tenant B's database — must fail.
- MySQL: tenant A user cannot `USE` tenant B's schema.
- MongoDB: tenant A user has roles only on its own database.

## 4. Domain TLS honesty

`POST /domains/:id/verify` is ACTIVE for DNS only after real TXT+A match. SSL is ACTIVE only after Traefik reports a TLS-enabled router. A domain that has not completed ACME stays `ISSUING` with `lastError` set.

## 5. Independent pentest (still required)

Commission an external test covering: auth/session, RBAC/tenant isolation, SSRF from the build/run path, container escape, Traefik dashboard exposure, Stripe webhook authenticity, and secret storage. Track findings in `LAUNCH_READINESS.md`.
