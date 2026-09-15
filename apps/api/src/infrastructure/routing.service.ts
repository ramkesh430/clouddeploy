import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Writes one Traefik file-provider config per project so
 * `{slug}.{PLATFORM_DOMAIN}` and verified custom hostnames route to the
 * running frontend, with `/api` and `api.{host}` going to the backend —
 * without a hand-written nginx file per project.
 */
@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async syncService(serviceId: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (service) await this.syncProject(service.projectId);
    return { configured: true };
  }

  async syncProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        domains: { where: { deletedAt: null } },
        services: {
          where: { deletedAt: null },
          include: { containers: { where: { status: "RUNNING", healthy: true }, orderBy: { replicaIndex: "asc" } } },
        },
      },
    });
    if (!project) return { configured: false, reason: "Project not found" };

    const frontend = project.services.find((s) => s.type === "WEB_SERVICE" || s.type === "STATIC_SITE")
      ?? project.services.find((s) => s.port && !s.isPrivate);
    const backend = project.services.find((s) => s.type === "API_SERVICE");
    const frontendUrl = frontend ? this.containerUrl(frontend) : null;
    const backendUrl = backend ? this.containerUrl(backend) : null;

    const edgeReady = this.config.get<string>("PLATFORM_EDGE_READY") === "true"
      || (this.config.get<string>("NODE_ENV") === "production" && !!this.config.get<string>("PUBLIC_SERVER_IP"));
    const useAcme = edgeReady;

    const hosts = project.domains
      .filter((d) => d.status === "ACTIVE" || d.type === "PLATFORM")
      .map((d) => d.hostname);

    const snapshot = this.buildSnapshot(project.slug, hosts, frontendUrl, backendUrl, useAcme);

    const configuredPath = this.config.get<string>("TRAEFIK_DYNAMIC_CONFIG_PATH") ?? process.env.TRAEFIK_DYNAMIC_CONFIG_PATH;
    if (configuredPath && hosts.length > 0) {
      const target = path.resolve(configuredPath, `project-${project.id}.json`);
      const temp = `${target}.${process.pid}.tmp`;
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(temp, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
      await fs.rename(temp, target);
      this.logger.log(`Updated Traefik routing for ${project.slug} (${hosts.join(", ")})`);
    }

    return { configured: true, hosts, frontendUrl, backendUrl, snapshot };
  }

  private containerUrl(service: { port: number | null; isPrivate: boolean; containers: Array<{ hostPort: number | null; privateIp: string | null }> }): string | null {
    if (!service.port || service.isPrivate) return null;
    const container = service.containers[0];
    if (!container) return null;
    if (container.hostPort) return `http://host.docker.internal:${container.hostPort}`;
    if (container.privateIp && container.privateIp !== "127.0.0.1") return `http://${container.privateIp}:${service.port}`;
    return null;
  }

  private buildSnapshot(slug: string, hosts: string[], frontendUrl: string | null, backendUrl: string | null, useAcme: boolean) {
    const routers: Record<string, unknown> = {};
    const services: Record<string, unknown> = {};
    const middlewares: Record<string, unknown> = {
      [`https-redirect-${slug}`]: {
        redirectScheme: { scheme: "https", permanent: true },
      },
    };

    const tls = useAcme ? { certResolver: "letsencrypt" } : {};

    for (const hostname of hosts) {
      const key = hostname.replace(/[^a-z0-9]+/g, "-");
      if (frontendUrl) {
        services[`${key}-web`] = { loadBalancer: { servers: [{ url: frontendUrl }] } };
        routers[`${key}-web-https`] = {
          rule: `Host(\`${hostname}\`)`,
          service: `${key}-web`,
          entryPoints: ["websecure"],
          tls,
        };
        routers[`${key}-web-http`] = {
          rule: `Host(\`${hostname}\`)`,
          service: `${key}-web`,
          entryPoints: ["web"],
          middlewares: [`https-redirect-${slug}`],
        };
      }
      if (backendUrl) {
        services[`${key}-api`] = { loadBalancer: { servers: [{ url: backendUrl }] } };
        routers[`${key}-api-https`] = {
          rule: `Host(\`${hostname}\`) && PathPrefix(\`/api\`)`,
          service: `${key}-api`,
          entryPoints: ["websecure"],
          tls,
          priority: 20,
        };
        routers[`${key}-api-host-https`] = {
          rule: `Host(\`api.${hostname}\`)`,
          service: `${key}-api`,
          entryPoints: ["websecure"],
          tls,
        };
        routers[`${key}-api-http`] = {
          rule: `Host(\`api.${hostname}\`) || Host(\`${hostname}\`) && PathPrefix(\`/api\`)`,
          service: `${key}-api`,
          entryPoints: ["web"],
          middlewares: [`https-redirect-${slug}`],
          priority: 20,
        };
      }
    }

    return { http: { routers, services, middlewares } };
  }
}
