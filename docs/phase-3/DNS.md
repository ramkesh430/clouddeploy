# DNS, platform subdomains, and custom domains

## Why `contruction-erp.clouddeploy.app` was NXDOMAIN

The dashboard stored `https://{slug}.clouddeploy.app` as `Project.productionUrl` on deploy **without** creating a DNS record, a Domain row, or a public edge. `clouddeploy.app` is not a zone this local process controls, so browsers fail with `DNS_PROBE_FINISHED_NXDOMAIN`.

Platform hostnames are now assigned automatically as Domain type `PLATFORM`, but they stay **Pending DNS** until public wildcard DNS actually resolves to `PUBLIC_SERVER_IP`.

## Development (localhost:3000)

Leave `PLATFORM_EDGE_READY=false` and `PUBLIC_SERVER_IP` empty.

- Each project still gets `{slug}.clouddeploy.app` in the Domains list.
- Status is Pending DNS. The UI will not treat it as a live link.
- Real container URLs (Cloudflare quick tunnels) remain the only clickable live URLs.

Optional local test via `/etc/hosts` (does **not** make public DNS work):

```
127.0.0.1 contruction-erp.clouddeploy.app
```

Then open `http://localhost:8000` (Traefik) with `Host: contruction-erp.clouddeploy.app`, or `https://localhost:8443` (Traefik default cert).

## Production DNS (you must create these)

At the registrar for `clouddeploy.app`:

| Type | Name | Value |
| --- | --- | --- |
| A | `*` | `PUBLIC_SERVER_IP` (load balancer / Traefik) |
| A | `@` | `PUBLIC_SERVER_IP` (optional apex) |

CNAME alternative if the load balancer has a hostname:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `*` | `edge.clouddeploy.app` |

Then set:

```
PLATFORM_DOMAIN=clouddeploy.app
PUBLIC_SERVER_IP=x.x.x.x
PLATFORM_EDGE_READY=true
TRAEFIK_HTTP_PORT=80
TRAEFIK_HTTPS_PORT=443
```

Publish Traefik 80/443 to the world. Let's Encrypt HTTP-01 needs port 80.

Wildcard certificates (`*.clouddeploy.app`) need **DNS-01** at the provider. Per-hostname certificates use HTTP-01 automatically once the A record exists.

## Custom domains

Customer creates:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` (or the subdomain) | `PUBLIC_SERVER_IP` |
| TXT | `_clouddeploy-verify.<hostname>` | token shown in the dashboard |
| CNAME | `www` | `hostname.` |

Then **Verify DNS**. SSL is requested only after verification succeeds.

## Reverse proxy

Traefik file provider (`infra/traefik/dynamic/project-<id>.json`) is written on deploy and on verify:

- `Host(slug.clouddeploy.app)` → frontend
- `Host(slug.clouddeploy.app) && PathPrefix(/api)` and `Host(api.slug.clouddeploy.app)` → backend
- HTTP → HTTPS redirect on the `web` entrypoint
