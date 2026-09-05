import { Injectable, Logger } from "@nestjs/common";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async syncService(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        project: true,
        containers: { where: { status: "RUNNING", healthy: true }, orderBy: { replicaIndex: "asc" } },
      },
    });
    if (!service || !service.port || service.isPrivate || !service.publicUrl) return { configured: false, reason: "Service is not publicly routable" };

    const key = `service-${service.id}`;
    const hostname = this.hostname(service.publicUrl);
    const snapshot = {
      http: {
        routers: {
          [key]: {
            rule: `Host(\`${hostname}\`)`,
            service: key,
            entryPoints: ["websecure"],
            tls: { certResolver: "letsencrypt" },
          },
        },
        services: {
          [key]: {
            loadBalancer: {
              servers: service.containers.flatMap((container) => container.privateIp ? [{ url: `http://${container.privateIp}:${service.port}` }] : []),
              healthCheck: {
                path: service.healthCheckPath,
                interval: `${service.healthCheckInterval}s`,
                timeout: `${service.healthCheckTimeout}s`,
              },
            },
          },
        },
      },
    };

    const configuredPath = process.env.TRAEFIK_DYNAMIC_CONFIG_PATH;
    if (configuredPath) {
      const target = path.resolve(configuredPath, `${key}.json`);
      const temp = `${target}.${process.pid}.tmp`;
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(temp, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
      await fs.rename(temp, target);
      this.logger.log(`Updated Traefik routing for ${service.name} with ${service.containers.length} healthy replica(s)`);
    }
    return { configured: true, healthyReplicas: service.containers.length, snapshot };
  }

  private hostname(value: string) {
    try { return new URL(value).hostname; } catch { return value.replace(/^https?:\/\//, "").split("/")[0]!; }
  }
}
