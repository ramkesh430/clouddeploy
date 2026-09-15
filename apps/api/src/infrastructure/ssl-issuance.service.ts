import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

interface TraefikRouter {
  name?: string;
  status?: string;
  rule?: string;
  tls?: unknown;
}

/**
 * Real certificate issuance through Traefik's ACME resolver. RoutingService
 * writes the Host() router; this service polls Traefik until that router
 * reports TLS. ACTIVE is only stored when Traefik actually has a certificate.
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

    const issued = await this.waitForCertificate(domain.hostname);
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
          const match = routers.find((r) => (r.rule ?? r.name ?? "").includes(routerKey) && r.tls);
          if (match && (match.status === "enabled" || !match.status)) return { ok: true };
          lastError = match
            ? `Router ${match.name} present but status=${match.status}`
            : `No TLS router for ${routerKey} yet — ACME HTTP-01 needs port 80 reachable on the domain's A record`;
        }
      } catch (err) {
        lastError = `Traefik API unreachable: ${(err as Error).message}`;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    return { ok: false, error: lastError };
  }
}
