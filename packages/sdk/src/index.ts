export interface CloudDeployOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export interface ListOptions { organizationId?: string; projectId?: string; limit?: number; cursor?: string }

export class CloudDeployError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) { super(message); }
}

export class CloudDeploy {
  readonly projects: ProjectsResource;
  readonly deployments: DeploymentsResource;
  readonly logs: LogsResource;
  readonly env: EnvironmentResource;
  readonly domains: DomainsResource;
  readonly database: DatabasesResource;

  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: CloudDeployOptions) {
    if (!options.apiKey) throw new Error("CloudDeploy apiKey is required");
    this.baseUrl = (options.baseUrl ?? "https://api.clouddeploy.app/api/v1").replace(/\/$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.projects = new ProjectsResource(this);
    this.deployments = new DeploymentsResource(this);
    this.logs = new LogsResource(this);
    this.env = new EnvironmentResource(this);
    this.domains = new DomainsResource(this);
    this.database = new DatabasesResource(this);
  }

  whoami<T = unknown>() { return this.request<T>("/auth/me"); }

  async request<T>(path: string, init: RequestInit & { body?: string } = {}): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.apiKey}`, "User-Agent": "clouddeploy-sdk/0.1.0", ...init.headers },
    });
    const json = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } } | null;
    if (!response.ok || json?.success === false) throw new CloudDeployError(response.status, json?.error?.code ?? "API_ERROR", json?.error?.message ?? `CloudDeploy API returned ${response.status}`, json?.error?.details);
    return (json?.data ?? json) as T;
  }
}

class ProjectsResource {
  constructor(private readonly client: CloudDeploy) {}
  list<T = unknown[]>(organizationId: string) { return this.client.request<T>(`/projects?organizationId=${encodeURIComponent(organizationId)}`); }
  get<T = unknown>(projectId: string) { return this.client.request<T>(`/projects/${projectId}`); }
  create<T = unknown>(input: { organizationId: string; name: string; slug: string; description?: string; region?: string }) { return this.client.request<T>("/projects", { method: "POST", body: JSON.stringify(input) }); }
}

class DeploymentsResource {
  constructor(private readonly client: CloudDeploy) {}
  list<T = unknown[]>(projectId: string) { return this.client.request<T>(`/deployments?projectId=${encodeURIComponent(projectId)}`); }
  get<T = unknown>(deploymentId: string) { return this.client.request<T>(`/deployments/${deploymentId}`); }
  create<T = unknown>(input: { projectId: string; serviceId?: string; branch?: string; environment?: "PRODUCTION" | "PREVIEW" | "DEVELOPMENT" }) { return this.client.request<T>("/deployments", { method: "POST", body: JSON.stringify(input) }); }
  redeploy<T = unknown>(deploymentId: string) { return this.client.request<T>(`/deployments/${deploymentId}/redeploy`, { method: "POST", body: "{}" }); }
  rollback<T = unknown>(deploymentId: string, targetDeploymentId: string) { return this.client.request<T>(`/deployments/${deploymentId}/rollback`, { method: "POST", body: JSON.stringify({ targetDeploymentId }) }); }
}

export interface DeploymentLog { id: string; level: string; message: string; timestamp: string }

class LogsResource {
  constructor(private readonly client: CloudDeploy) {}
  list(deploymentId: string, after?: string) { return this.client.request<DeploymentLog[]>(`/deployments/${deploymentId}/logs${after ? `?after=${encodeURIComponent(after)}` : ""}`); }
  async *stream(deploymentId: string, options: { signal?: AbortSignal; pollIntervalMs?: number } = {}): AsyncGenerator<DeploymentLog> {
    let after: string | undefined;
    const interval = options.pollIntervalMs ?? 1_500;
    while (!options.signal?.aborted) {
      const entries = await this.list(deploymentId, after);
      for (const entry of entries) { after = entry.timestamp; yield entry; }
      const deployment = await this.client.deployments.get<{ status: string }>(deploymentId);
      if (["LIVE", "FAILED", "CANCELLED", "ROLLED_BACK"].includes(deployment.status) && entries.length === 0) return;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, interval);
        options.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(options.signal?.reason ?? new Error("Aborted")); }, { once: true });
      }).catch((error) => { if (!options.signal?.aborted) throw error; });
    }
  }
}

class EnvironmentResource {
  constructor(private readonly client: CloudDeploy) {}
  list<T = unknown[]>(projectId: string, serviceId?: string) { return this.client.request<T>(`/environment-variables?projectId=${encodeURIComponent(projectId)}${serviceId ? `&serviceId=${encodeURIComponent(serviceId)}` : ""}`); }
  async set<T = unknown>(input: { projectId: string; serviceId?: string; key: string; value: string; isSecret?: boolean }) {
    const existing = await this.list<Array<{ id: string; key: string }>>(input.projectId, input.serviceId);
    const row = existing.find((item) => item.key === input.key);
    if (row) return this.client.request<T>(`/environment-variables/${row.id}`, { method: "PATCH", body: JSON.stringify({ value: input.value }) });
    return this.client.request<T>("/environment-variables", { method: "POST", body: JSON.stringify(input) });
  }
}

class DomainsResource {
  constructor(private readonly client: CloudDeploy) {}
  list<T = unknown[]>(organizationId: string) { return this.client.request<T>(`/domains?organizationId=${encodeURIComponent(organizationId)}`); }
  create<T = unknown>(organizationId: string, input: { projectId: string; hostname: string }) { return this.client.request<T>(`/domains?organizationId=${encodeURIComponent(organizationId)}`, { method: "POST", body: JSON.stringify(input) }); }
}

class DatabasesResource {
  constructor(private readonly client: CloudDeploy) {}
  list<T = unknown[]>(organizationId: string) { return this.client.request<T>(`/databases?organizationId=${encodeURIComponent(organizationId)}`); }
  create<T = unknown>(input: { organizationId: string; name: string; engine: "POSTGRESQL" | "MYSQL" | "MARIADB"; region?: string; resourcePreset?: string }) { return this.client.request<T>("/databases", { method: "POST", body: JSON.stringify(input) }); }
}
