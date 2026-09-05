# Public API v1

Base URL: `https://api.clouddeploy.app/api/v1`. Interactive OpenAPI documentation is served at `/api/docs` by the API process.

## Authentication

Send `Authorization: Bearer <token>`. Browser sessions use a short-lived JWT plus an HTTP-only refresh cookie. Automation uses a `cd_…` API key. Keys are organization-bound, permission-scoped, optionally restricted to exact IPv4 addresses/CIDRs, and limited per minute by plan (Free 60, Developer 120, Pro 300, Business 1,000, Enterprise 5,000). A key-level value may only lower the plan ceiling.

Common permissions are `projects:read|write`, `services:read|write`, `deployments:read|write`, `logs:read`, `environment:read|write`, `databases:read|write`, `domains:read|write`, and `ai:write`.

Successful responses are `{ "success": true, "data": … }`; errors are `{ "success": false, "error": { "code", "message", "details" } }`.

## Main resources

| Area | Operations |
| --- | --- |
| Identity | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, password/email flows |
| Organizations | list/create/detail; member list, invite, role update, remove |
| Projects | list/create/detail/update, pause/resume/archive/delete, member grants |
| Services | list/create/detail/update/restart/delete; worker listing |
| Deployments | list/create/detail, logs, redeploy, rollback, cancel |
| Environment | list/create/update/delete, reveal, bulk import |
| Data | database CRUD/metrics/connection/backup/restore/users/browser/query; Redis CRUD/attach/metrics; storage buckets/objects |
| Domains | list/create/detail/verify/delete |
| Billing and usage | plans, billing summary/checkout/portal/cancel, usage |
| Automation | API keys, outgoing webhooks/deliveries, cron jobs, alerts, notifications |
| GitHub | OAuth connection, repositories, stack detection/import, verified webhook |
| Templates | categories, list, detail, one-click deploy |
| Agency | dashboard, client CRUD/project mapping/portal grants, branding |
| Security | overview, 2FA setup/enable/disable, revoke other sessions |
| Support and abuse | ticket conversation APIs; abuse report submission |
| Regions and scaling | regions, dependency warnings, autoscaling get/update/evaluate |
| Status | unauthenticated `GET /status` |

## AI examples

`POST /ai/repository-analysis` accepts an organization/project, repository name, and a bounded array of `{ path, content }`. Sensitive files are dropped and content is redacted. The structured result includes `services`, `runtime`, `framework`, commands, port, database/Redis/storage needs, environment suggestions, resource recommendations, architecture, and warnings.

`POST /ai/log-analysis` returns problem, explanation, affected service, recommended fix, confidence, and typed proposed actions. `POST /ai/fixes/:proposalId/apply` is restricted to workspace OWNER/ADMIN. `POST /ai/dockerfile` returns reviewable Dockerfile text and never pushes to Git. `POST /ai/resource-recommendations` combines framework, current size, traffic, build, and dependency inputs.

## Server-agent contract

Registered agents use `X-Agent-Token` rather than user auth:

- `POST /server-agent/heartbeat`: health/capacity plus per-container health.
- `GET /server-agent/commands`: acknowledge pending drain/runtime commands.
- `POST /server-agent/commands/:id/complete`: report command result.

The one-time agent token is returned only by the platform-admin registration endpoint.

## SDK

```ts
import { CloudDeploy } from "@clouddeploy/sdk";

const client = new CloudDeploy({ apiKey: process.env.CLOUDDEPLOY_API_KEY! });
const projects = await client.projects.list("org_id");
const deployment = await client.deployments.create({ projectId: "project_id" });
for await (const line of client.logs.stream(deployment.id)) console.log(line.message);
```

List endpoints that can grow unbounded accept `limit` and/or `cursor`; SDK consumers should not assume one response contains an entire collection.

