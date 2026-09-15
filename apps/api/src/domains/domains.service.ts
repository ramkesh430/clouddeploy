import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as dns } from "node:dns";
import type { Domain, Prisma, Project, Service } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDomainDto } from "./dto/create-domain.dto";
import { SslIssuanceService } from "../infrastructure/ssl-issuance.service";
import { RoutingService } from "../infrastructure/routing.service";
import { isReachableLiveUrl, platformHostname, sanitizeDnsSlug } from "./hostname";

export interface ProjectUrlView {
  assignedHostname: string;
  liveUrl: string | null;
  domainStatus: string;
  domainReady: boolean;
  publicEdgeReady: boolean;
  domainMessage: string | null;
}

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ssl: SslIssuanceService,
    private readonly routing: RoutingService,
  ) {}

  platformDomain(): string {
    return (this.config.get<string>("PLATFORM_DOMAIN") ?? "clouddeploy.app").replace(/^\./, "");
  }

  publicServerIp(): string | null {
    const ip = this.config.get<string>("PUBLIC_SERVER_IP") ?? this.config.get<string>("PLATFORM_INGRESS_IP");
    if (!ip || ip === "127.0.0.1" || ip === "0.0.0.0" || ip.startsWith("203.0.113.")) return null;
    return ip;
  }

  publicEdgeReady(): boolean {
    const explicit = this.config.get<string>("PLATFORM_EDGE_READY");
    if (explicit === "true") return true;
    if (explicit === "false") return false;
    return this.config.get<string>("NODE_ENV") === "production" && !!this.publicServerIp();
  }

  isDevelopment(): boolean {
    return (this.config.get<string>("NODE_ENV") ?? "development") !== "production";
  }

  edgeBanner(): string | null {
    if (this.publicEdgeReady()) return null;
    return "Public domains require a publicly accessible deployment server. *.clouddeploy.app will not resolve (NXDOMAIN) until wildcard DNS points at PUBLIC_SERVER_IP.";
  }

  async list(organizationId: string) {
    const projects = await this.prisma.project.findMany({ where: { organizationId, deletedAt: null } });
    for (const project of projects) {
      await this.ensurePlatformDomain(project);
    }

    const rows = await this.prisma.domain.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        ssl: true,
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            productionUrl: true,
            services: { where: { deletedAt: null }, select: { id: true, name: true, type: true, publicUrl: true, port: true } },
          },
        },
      },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });

    return {
      edge: {
        platformDomain: this.platformDomain(),
        publicServerIp: this.publicServerIp(),
        publicEdgeReady: this.publicEdgeReady(),
        development: this.isDevelopment(),
        dnsProvider: this.config.get<string>("DNS_PROVIDER") ?? null,
        banner: this.edgeBanner(),
        wildcardRecord: this.wildcardInstruction(),
      },
      data: rows.map((row) => this.present(row)),
    };
  }

  async create(organizationId: string, dto: CreateDomainDto) {
    const hostname = dto.hostname.toLowerCase().replace(/\.$/, "");
    const existing = await this.prisma.domain.findFirst({ where: { hostname } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException("This domain is already connected to a project");
    }

    const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, organizationId, deletedAt: null } });
    if (!project) throw new NotFoundException("Project not found");

    if (hostname.endsWith(`.${this.platformDomain()}`) || hostname === this.platformDomain()) {
      throw new BadRequestException(`Use the automatic platform subdomain ${platformHostname(project.slug, this.platformDomain())} instead of adding it as a custom domain`);
    }

    const frontend = await this.defaultFrontend(project.id);
    const data = {
      organizationId,
      projectId: dto.projectId,
      hostname,
      type: "CUSTOM" as const,
      environment: dto.environment ?? "PRODUCTION",
      status: "PENDING" as const,
      dnsRecords: this.customDnsRecords(hostname),
      lastError: null,
      targetServiceId: frontend?.id ?? null,
    };

    const domain = existing
      ? await this.prisma.domain.update({ where: { id: existing.id }, data: { ...data, deletedAt: null } })
      : await this.prisma.domain.create({ data });

    this.logger.log(`Custom domain ${hostname} queued for ${project.slug} — pending DNS`);
    return this.present(await this.findOne(domain.id));
  }

  async findOne(domainId: string) {
    const domain = await this.prisma.domain.findFirst({
      where: { id: domainId, deletedAt: null },
      include: {
        ssl: true,
        project: { select: { id: true, name: true, slug: true, productionUrl: true, services: { where: { deletedAt: null }, select: { id: true, name: true, type: true, publicUrl: true, port: true } } } },
      },
    });
    if (!domain) throw new NotFoundException("Domain not found");
    return domain;
  }

  async verify(domainId: string) {
    const domain = await this.findOne(domainId);
    await this.prisma.domain.update({ where: { id: domainId }, data: { status: "VERIFYING", lastError: null } });

    const { ok, reasons } = domain.type === "PLATFORM"
      ? await this.checkPlatformDns(domain.hostname)
      : await this.checkCustomDns(domain.hostname, domain.dnsRecords as { txt?: { value: string }; a?: { value: string }; cname?: { value: string } });

    if (!ok) {
      const failed = await this.prisma.domain.update({
        where: { id: domainId },
        data: { status: "FAILED", lastError: reasons.join("; ") },
        include: { ssl: true, project: { select: { id: true, name: true, slug: true, productionUrl: true, services: { where: { deletedAt: null }, select: { id: true, name: true, type: true, publicUrl: true, port: true } } } } },
      });
      this.logger.warn(`DNS verify failed for ${domain.hostname}: ${reasons.join("; ")}`);
      return { ...this.present(failed), verificationError: reasons.join("; ") };
    }

    const verified = await this.prisma.domain.update({
      where: { id: domainId },
      data: { status: "ACTIVE", verifiedAt: new Date(), lastError: null },
    });

    await this.routing.syncProject(verified.projectId);

    let sslIssuance: { status: string; lastError?: string } | null = null;
    if (this.publicEdgeReady()) {
      sslIssuance = await this.ssl.issueForDomain(domainId);
    } else {
      await this.prisma.sSLRecord.upsert({
        where: { domainId },
        create: { domainId, status: "PENDING", lastError: this.edgeBanner() ?? undefined },
        update: { status: "PENDING", lastError: this.edgeBanner() ?? undefined },
      });
    }

    await this.refreshProjectLiveUrl(verified.projectId);
    const fresh = await this.findOne(domainId);
    this.logger.log(`DNS verified for ${domain.hostname}`);
    return { ...this.present(fresh), sslIssuance };
  }

  async refreshSsl(domainId: string) {
    await this.findOne(domainId);
    if (!this.publicEdgeReady()) {
      throw new BadRequestException(this.edgeBanner() ?? "SSL issuance needs a public edge");
    }
    const ssl = await this.ssl.issueForDomain(domainId);
    return { ...this.present(await this.findOne(domainId)), sslIssuance: ssl };
  }

  async remove(domainId: string) {
    const domain = await this.findOne(domainId);
    if (domain.type === "PLATFORM") {
      throw new BadRequestException("The platform subdomain is created automatically and cannot be removed");
    }
    await this.prisma.domain.update({ where: { id: domainId }, data: { deletedAt: new Date() } });
    await this.routing.syncProject(domain.projectId);
    return { removed: true };
  }

  async ensurePlatformDomain(project: Pick<Project, "id" | "organizationId" | "slug">): Promise<Domain> {
    const hostname = await this.allocatePlatformHostname(project.slug, project.id);
    const frontend = await this.defaultFrontend(project.id);
    const existing = await this.prisma.domain.findFirst({
      where: { projectId: project.id, type: "PLATFORM", deletedAt: null },
    });
    if (existing) {
      const shouldDemote = existing.status === "ACTIVE" && !this.publicEdgeReady();
      const data: Prisma.DomainUpdateInput = {
        dnsRecords: this.platformDnsRecords(),
        targetServiceId: frontend?.id ?? existing.targetServiceId,
      };
      if (existing.hostname !== hostname) {
        const clash = await this.prisma.domain.findFirst({ where: { hostname, id: { not: existing.id } } });
        if (!clash) data.hostname = hostname;
      }
      if (shouldDemote) {
        data.status = "PENDING";
        data.verifiedAt = null;
        data.lastError = this.edgeBanner();
        await this.prisma.sSLRecord.updateMany({ where: { domainId: existing.id, status: "ACTIVE" }, data: { status: "PENDING", lastError: this.edgeBanner() ?? undefined } });
      }
      return this.prisma.domain.update({ where: { id: existing.id }, data });
    }

    const deleted = await this.prisma.domain.findFirst({ where: { hostname } });
    if (deleted?.deletedAt) {
      return this.prisma.domain.update({
        where: { id: deleted.id },
        data: {
          organizationId: project.organizationId,
          projectId: project.id,
          type: "PLATFORM",
          status: "PENDING",
          dnsRecords: this.platformDnsRecords(),
          lastError: this.edgeBanner(),
          targetServiceId: frontend?.id ?? null,
          deletedAt: null,
          verifiedAt: null,
        },
      });
    }

    return this.prisma.domain.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        hostname,
        type: "PLATFORM",
        status: "PENDING",
        dnsRecords: this.platformDnsRecords(),
        lastError: this.edgeBanner(),
        targetServiceId: frontend?.id ?? null,
      },
    });
  }

  async urlViewForProject(project: Pick<Project, "id" | "organizationId" | "slug"> & {
    services?: Array<{ type: string; publicUrl?: string | null; name?: string }>;
    domains?: Array<{ type: string; status: string; hostname: string }>;
  }): Promise<ProjectUrlView> {
    const platform = await this.ensurePlatformDomain(project);
    const domains = project.domains ?? (await this.prisma.domain.findMany({ where: { projectId: project.id, deletedAt: null } }));
    const activeCustom = domains.find((d) => d.type === "CUSTOM" && d.status === "ACTIVE");
    const platformActive = platform.status === "ACTIVE";
    const tunnel = (project.services ?? []).find((s) => isReachableLiveUrl(s.publicUrl))?.publicUrl ?? null;

    const liveUrl = activeCustom
      ? `https://${activeCustom.hostname}`
      : platformActive
        ? `https://${platform.hostname}`
        : tunnel;

    const domainReady = !!activeCustom || platformActive;
    return {
      assignedHostname: platform.hostname,
      liveUrl,
      domainStatus: activeCustom?.status ?? platform.status,
      domainReady,
      publicEdgeReady: this.publicEdgeReady(),
      domainMessage: domainReady
        ? null
        : this.publicEdgeReady()
          ? "Domain configuration pending"
          : "Public domains require a publicly accessible deployment server.",
    };
  }

  async refreshProjectLiveUrl(projectId: string): Promise<ProjectUrlView> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: { services: { where: { deletedAt: null } }, domains: { where: { deletedAt: null } } },
    });
    if (!project) throw new NotFoundException("Project not found");
    const view = await this.urlViewForProject(project);
    if (view.liveUrl !== project.productionUrl) {
      await this.prisma.project.update({ where: { id: projectId }, data: { productionUrl: view.liveUrl } });
    }
    return view;
  }

  async syncAfterDeploy(projectId: string): Promise<ProjectUrlView> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
    if (!project) throw new NotFoundException("Project not found");
    await this.ensurePlatformDomain(project);
    await this.routing.syncProject(projectId);
    return this.refreshProjectLiveUrl(projectId);
  }

  private async allocatePlatformHostname(slug: string, projectId: string): Promise<string> {
    const base = platformHostname(slug, this.platformDomain());
    const taken = await this.prisma.domain.findFirst({ where: { hostname: base } });
    if (!taken || taken.projectId === projectId || taken.deletedAt) return base;
    return platformHostname(`${sanitizeDnsSlug(slug)}-${projectId.slice(-6)}`, this.platformDomain());
  }

  private platformDnsRecords() {
    const ip = this.publicServerIp() ?? "<PUBLIC_SERVER_IP>";
    const zone = this.platformDomain();
    return {
      wildcard: { type: "A", name: `*.${zone}`, value: ip, ttl: 300, purpose: "All project subdomains" },
      apex: { type: "A", name: zone, value: ip, ttl: 300, purpose: "Optional apex" },
      wildcardCname: { type: "CNAME", name: `*.${zone}`, value: `edge.${zone}.`, ttl: 300, purpose: "Use instead of A if the load balancer has a hostname" },
    };
  }

  private customDnsRecords(hostname: string) {
    const ip = this.publicServerIp() ?? "<PUBLIC_SERVER_IP>";
    const zone = this.platformDomain();
    return {
      a: { type: "A", name: "@", value: ip, ttl: 3600, purpose: "Apex → platform ingress" },
      cname: { type: "CNAME", name: "www", value: `${hostname}.`, ttl: 3600, purpose: "www → apex" },
      alias: { type: "CNAME", name: hostname, value: `edge.${zone}.`, ttl: 3600, purpose: "Alternative to A if you CNAME to the platform" },
      txt: { type: "TXT", name: `_clouddeploy-verify.${hostname}`, value: this.verificationToken(hostname), ttl: 300, purpose: "Ownership token" },
    };
  }

  private wildcardInstruction() {
    const ip = this.publicServerIp() ?? "<PUBLIC_SERVER_IP>";
    return { type: "A", name: `*.${this.platformDomain()}`, value: ip };
  }

  private async checkPlatformDns(hostname: string): Promise<{ ok: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    if (!this.publicEdgeReady() || !this.publicServerIp()) {
      reasons.push("Public domains require a publicly accessible deployment server. Set PUBLIC_SERVER_IP and point *." + this.platformDomain() + " at that address.");
      return { ok: false, reasons };
    }
    const expected = this.publicServerIp()!;
    try {
      const addresses = await dns.resolve4(hostname);
      if (!addresses.includes(expected)) {
        reasons.push(`${hostname} resolves to ${addresses.join(", ")}, not ${expected}. Add A ${this.wildcardInstruction().name} → ${expected}.`);
      }
    } catch {
      try {
        const cnames = await dns.resolveCname(hostname);
        reasons.push(`${hostname} is a CNAME to ${cnames.join(", ")} — it must ultimately resolve to ${expected}.`);
      } catch {
        reasons.push(`${hostname} does not resolve (NXDOMAIN). Configure wildcard DNS: A ${this.wildcardInstruction().name} → ${expected}.`);
      }
    }
    return { ok: reasons.length === 0, reasons };
  }

  private async checkCustomDns(hostname: string, records: { txt?: { value: string }; a?: { value: string } }): Promise<{ ok: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    if (!this.publicEdgeReady() || !this.publicServerIp()) {
      reasons.push("Public domains require a publicly accessible deployment server. Custom domains cannot be activated on localhost.");
      return { ok: false, reasons };
    }

    const expectedTxt = records.txt?.value ?? this.verificationToken(hostname);
    const expectedA = this.publicServerIp()!;

    try {
      const txtRecords = await dns.resolveTxt(`_clouddeploy-verify.${hostname}`);
      const flattened = txtRecords.map((chunks) => chunks.join(""));
      if (!flattened.some((value) => value === expectedTxt)) {
        reasons.push(`TXT record at _clouddeploy-verify.${hostname} does not match the verification token`);
      }
    } catch {
      reasons.push(`TXT record at _clouddeploy-verify.${hostname} not found`);
    }

    try {
      const addresses = await dns.resolve4(hostname);
      if (!addresses.includes(expectedA)) {
        reasons.push(`A record for ${hostname} resolves to ${addresses.join(", ")}, not ${expectedA}`);
      }
    } catch {
      reasons.push(`A record for ${hostname} not found — point it at ${expectedA} (or CNAME to edge.${this.platformDomain()})`);
    }

    return { ok: reasons.length === 0, reasons };
  }

  private async defaultFrontend(projectId: string) {
    const services = await this.prisma.service.findMany({ where: { projectId, deletedAt: null } });
    return services.find((s) => s.type === "WEB_SERVICE" || s.type === "STATIC_SITE") ?? services.find((s) => s.port && !s.isPrivate) ?? null;
  }

  private present(row: Domain & { ssl?: { status: string; lastError?: string | null } | null; project?: { id: string; name: string; slug: string; productionUrl: string | null; services?: Array<{ id: string; name: string; type: string; publicUrl: string | null; port: number | null }> } }) {
    const target = row.project?.services?.find((s) => s.id === row.targetServiceId)
      ?? row.project?.services?.find((s) => s.type === "WEB_SERVICE" || s.type === "STATIC_SITE");
    const tunnel = row.project?.services?.find((s) => isReachableLiveUrl(s.publicUrl))?.publicUrl ?? null;
    const openUrl = row.status === "ACTIVE" && this.publicEdgeReady()
      ? `https://${row.hostname}`
      : tunnel;
    return {
      ...row,
      dnsStatus: row.status,
      sslStatus: row.ssl?.status ?? "PENDING",
      target: target?.name ?? (row.type === "PLATFORM" ? "frontend" : null),
      assignedUrl: `https://${row.hostname}`,
      openUrl,
      copyRecord: row.type === "PLATFORM"
        ? this.wildcardInstruction()
        : { type: "A", name: "@", value: this.publicServerIp() ?? "<PUBLIC_SERVER_IP>" },
    };
  }

  private verificationToken(hostname: string): string {
    return `clouddeploy-verify=${Buffer.from(hostname).toString("base64url")}`;
  }
}
