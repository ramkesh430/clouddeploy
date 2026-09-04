import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDomainDto } from "./dto/create-domain.dto";

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
   * Simulated DNS verification + SSL issuance. The real implementation
   * resolves the TXT/A records via DNS and drives Let's Encrypt through
   * Traefik's ACME resolver (see infra/traefik).
   */
  async verify(domainId: string) {
    const domain = await this.findOne(domainId);
    await this.prisma.domain.update({ where: { id: domainId }, data: { status: "VERIFYING" } });

    setTimeout(async () => {
      await this.prisma.domain.update({
        where: { id: domainId },
        data: { status: "ACTIVE", verifiedAt: new Date() },
      });
      await this.prisma.sSLRecord.upsert({
        where: { domainId },
        create: {
          domainId,
          status: "ACTIVE",
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
        update: {
          status: "ACTIVE",
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });
    }, 4000);

    return { ...domain, status: "VERIFYING" };
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
