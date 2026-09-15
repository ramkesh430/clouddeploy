import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { traefikTlsRouterSnapshot } from "@clouddeploy/docker";
import { PrismaService } from "../prisma/prisma.service";

interface TraefikRouter {
  name?: string;
  status?: string;
  tls?: unknown;
}

/**
 * Real certificate issuance through Traefik's already-configured ACME
 * resolver (`letsencrypt` in infra/docker/docker-compose.yml). After DNS
 * verification we write a file-provider router with `tls.certResolver`,
 * then poll Traefik's API until the router reports TLS. ACTIVE is only
 * stored when Traefik actually has a certificate — never faked.
 *
 * Let's Encrypt HTTP-01 always hits port 80 on PLATFORM_INGRESS_IP, so
 * production must publish Traefik's `web` entrypoint there
 * (`TRAEFIK_HTTP_PORT=80`).
 */
@Injectable()
export class SslIssuanceService {
  private readonly logger = new Logger(SslIssuanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issueForDomain(domainId: string): Promise<{ status: string; issuer?: string; expiresAt?: Date; lastError?: string }> {
    const domain = await this.prisma.domain.findFirst({
      where: { id: domainId, deletedAt: null },
      include: {
        ssl: true,
        project: { include: { services: { where: { deletedAt: null }, include: { containers: { where: { status: "RUNNING", healthy: true } } } } } },
      },
    });
    if (!domain) return { status: "FAILED", lastError: "Domain not found" };

    await this.prisma.sSLRecord.upsert({
      where: { domainId },
      create: { domainId, status: "ISSUING" },
      update: { status: "ISSUING", lastError: null },
    });

    const backend = this.backendUrl(domain);
    const snapshot = traefikTlsRouterSnapshot({
      key: `domain-${domain.id}`,
      hostname: domain.hostname,
      backendUrl: backend,
    });

    const configuredPath = this.dynamicPath();
    if (configuredPath) {
      const target = path.resolve(configuredPath, `domain-${domain.id}.json`);
      const temp = `${target}.${process.pid}.tmp`;
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(temp, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
      await fs.rename(temp, target);
      this.logger.log(`Wrote Traefik ACME router for ${domain.hostname} -> ${backend}`);
    }

    const issued = await this.waitForCertificate(`domain-${domain.id}`);
    if (issued.ok) {
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      await this.prisma.sSLRecord.update({
        where: { domainId },
        data: { status: "ACTIVE", issuer: "Let's Encrypt", issuedAt: new Date(), expiresAt, lastError: null },
      });
      return { status: "ACTIVE", issuer: "Let's Encrypt", expiresAt };
    }

    const lastError = issued.error ?? "Let's Encrypt has not issued a certificate yet. HTTP-01 requires port 80 on PLATFORM_INGRESS_IP.";
    await this.prisma.sSLRecord.update({
      where: { domainId },
      data: { status: "ISSUING", lastError },
    });
    return { status: "ISSUING", lastError };
  }

  private backendUrl(domain: {
    project: { services: Array<{ port: number | null; containers: Array<{ hostPort: number | null; privateIp: string | null }> }> };
  }): string {
    for (const service of domain.project.services) {
      const container = service.containers[0];
      if (container?.hostPort) return `http://host.docker.internal:${container.hostPort}`;
      if (container?.privateIp && service.port) return `http://${container.privateIp}:${service.port}`;
    }
    return "http://127.0.0.1:9";
  }

  private dynamicPath(): string | null {
    const fromEnv = this.config.get<string>("TRAEFIK_DYNAMIC_CONFIG_PATH") ?? process.env.TRAEFIK_DYNAMIC_CONFIG_PATH;
    if (fromEnv) return fromEnv;
    const candidates = [
      path.resolve(process.cwd(), "infra/traefik/dynamic"),
      path.resolve(process.cwd(), "../../infra/traefik/dynamic"),
    ];
    return candidates[0] ?? null;
  }

  private async waitForCertificate(routerKey: string): Promise<{ ok: boolean; error?: string }> {
    const api = this.config.get<string>("TRAEFIK_API") ?? "http://localhost:8090";
    const deadline = Date.now() + 45_000;
    let lastError = `Traefik API at ${api} did not report a TLS-enabled router yet`;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${api}/api/http/routers`);
        if (!res.ok) {
          lastError = `Traefik API ${res.status} ${res.statusText}`;
        } else {
          const routers = (await res.json()) as TraefikRouter[];
          const match = routers.find((r) => (r.name ?? "").startsWith(routerKey) && r.tls);
          if (match && match.status === "enabled") return { ok: true };
          lastError = match
            ? `Router ${match.name} present but status=${match.status}`
            : `No TLS router named ${routerKey} yet — ACME HTTP-01 needs port 80 reachable on the domain's A record`;
        }
      } catch (err) {
        lastError = `Traefik API unreachable: ${(err as Error).message}`;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    return { ok: false, error: lastError };
  }
}
