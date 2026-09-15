import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as dns } from "node:dns";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDomainDto } from "./dto/create-domain.dto";
import { SslIssuanceService } from "../infrastructure/ssl-issuance.service";

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ssl: SslIssuanceService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.domain.findMany({
      where: { organizationId, deletedAt: null },
      include: { ssl: true, project: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(organizationId: string, dto: CreateDomainDto) {
    const existing = await this.prisma.domain.findUnique({ where: { hostname: dto.hostname } });
    if (existing) {
      throw new ConflictException("This domain is already connected to a project");
    }

    const platformIp = this.config.get<string>("PLATFORM_INGRESS_IP") ?? "203.0.113.10";
    const dnsRecords = {
      a: { type: "A", name: "@", value: platformIp, ttl: 3600 },
      cname: { type: "CNAME", name: "www", value: `${dto.hostname}.`, ttl: 3600 },
      txt: { type: "TXT", name: `_clouddeploy-verify.${dto.hostname}`, value: this.verificationToken(dto.hostname), ttl: 300 },
    };

    return this.prisma.domain.create({
      data: {
        organizationId,
        projectId: dto.projectId,
        hostname: dto.hostname,
        type: "CUSTOM",
        environment: dto.environment ?? "PRODUCTION",
        status: "PENDING",
        dnsRecords,
      },
    });
  }

  async findOne(domainId: string) {
    const domain = await this.prisma.domain.findFirst({ where: { id: domainId, deletedAt: null }, include: { ssl: true } });
    if (!domain) throw new NotFoundException("Domain not found");
    return domain;
  }

  /**
   * Real DNS verification: actually resolves the TXT ownership record and
   * the apex A record over the network and only marks the domain ACTIVE if
   * both genuinely match what `create()` asked the user to configure —
   * previously this just waited 4 seconds and marked every domain ACTIVE
   * unconditionally, regardless of whether the user had touched DNS at all.
   *
   * SSL is deliberately left PENDING rather than faked ACTIVE: real
   * issuance needs Traefik's ACME resolver to complete an HTTP-01/DNS-01
   * challenge against this hostname, which only works once the domain
   * really resolves to a publicly reachable edge (see
   * `TRAEFIK_DYNAMIC_CONFIG_PATH` and docs/phase-3/KNOWN_LIMITATIONS.md) —
   * that's an operator/edge-deployment step this API process can't perform
   * or observe on its own, so claiming ACTIVE here would just be a
   * differently-shaped version of the same fake-success bug.
   */
  async verify(domainId: string) {
    const domain = await this.findOne(domainId);
    await this.prisma.domain.update({ where: { id: domainId }, data: { status: "VERIFYING" } });

    const { ok, reasons } = await this.checkDns(domain.hostname, domain.dnsRecords as { txt: { value: string }; a: { value: string } });

    if (!ok) {
      const failed = await this.prisma.domain.update({
        where: { id: domainId },
        data: { status: "FAILED" },
        include: { ssl: true },
      });
      return { ...failed, verificationError: reasons.join("; ") };
    }

    const verified = await this.prisma.domain.update({
      where: { id: domainId },
      data: { status: "ACTIVE", verifiedAt: new Date() },
      include: { ssl: true },
    });
    const ssl = await this.ssl.issueForDomain(domainId);
    const fresh = await this.prisma.domain.findFirst({ where: { id: domainId }, include: { ssl: true } });
    return { ...(fresh ?? verified), sslIssuance: ssl };
  }

  async refreshSsl(domainId: string) {
    await this.findOne(domainId);
    const ssl = await this.ssl.issueForDomain(domainId);
    const domain = await this.findOne(domainId);
    return { ...domain, sslIssuance: ssl };
  }

  /** Resolves the TXT ownership token and the apex A record for real over
   * DNS. Missing/mismatched records fail closed with a human-readable
   * reason rather than throwing — DNS not having propagated yet is the
   * expected, common case for a domain a user just configured. */
  private async checkDns(hostname: string, records: { txt: { value: string }; a: { value: string } }): Promise<{ ok: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    try {
      const txtRecords = await dns.resolveTxt(`_clouddeploy-verify.${hostname}`);
      const flattened = txtRecords.map((chunks) => chunks.join(""));
      if (!flattened.some((value) => value === records.txt.value)) {
        reasons.push(`TXT record at _clouddeploy-verify.${hostname} doesn't match the expected verification token yet`);
      }
    } catch {
      reasons.push(`TXT record at _clouddeploy-verify.${hostname} not found — add the TXT record shown below and wait for DNS to propagate`);
    }

    try {
      const addresses = await dns.resolve4(hostname);
      if (!addresses.includes(records.a.value)) {
        reasons.push(`A record for ${hostname} resolves to ${addresses.join(", ")}, not the platform IP ${records.a.value}`);
      }
    } catch {
      reasons.push(`A record for ${hostname} not found — point it at the platform IP shown below`);
    }

    return { ok: reasons.length === 0, reasons };
  }

  async remove(domainId: string) {
    await this.findOne(domainId);
    await this.prisma.domain.update({ where: { id: domainId }, data: { deletedAt: new Date() } });
    return { removed: true };
  }

  private verificationToken(hostname: string): string {
    return `clouddeploy-verify=${Buffer.from(hostname).toString("base64url")}`;
  }
}
