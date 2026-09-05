import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AssignClientProjectDto, CreateAgencyClientDto, UpdateAgencyClientDto, UpdateBrandingDto, UpdatePortalAccessDto } from "./dto/agency.dto";

@Injectable()
export class AgencyService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(organizationId: string) {
    const [clients, projects, storage, expiringDomains, failedBackups] = await Promise.all([
      this.prisma.agencyClient.count({ where: { organizationId, status: "ACTIVE" } }),
      this.prisma.clientProject.findMany({
        where: { client: { organizationId } },
        include: { project: { include: { services: { where: { deletedAt: null }, select: { status: true } } } } },
      }),
      this.prisma.storageObject.aggregate({ where: { bucket: { organizationId } }, _sum: { sizeBytes: true } }),
      this.prisma.domain.count({
        where: {
          organizationId,
          ssl: { expiresAt: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
          deletedAt: null,
        },
      }),
      this.prisma.databaseBackup.count({
        where: { database: { organizationId }, status: "FAILED", createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    const healthy = projects.filter(({ project }) => project.services.length > 0 && project.services.every((service) => service.status === "RUNNING")).length;
    const failed = projects.filter(({ project }) => project.services.some((service) => service.status === "FAILED")).length;
    return {
      clients,
      projects: projects.length,
      healthy,
      failed,
      monthlyHostingCostCents: projects.reduce((sum, item) => sum + item.monthlyCostCents, 0),
      monthlyRevenueCents: projects.reduce((sum, item) => sum + item.monthlyRevenueCents, 0),
      storageBytes: String(storage._sum.sizeBytes ?? 0),
      expiringDomains,
      failedBackups,
    };
  }

  async listClients(organizationId: string, limit = 50, cursor?: string) {
    const rows = await this.prisma.agencyClient.findMany({
      where: { organizationId },
      include: { _count: { select: { projects: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null };
  }

  async createClient(dto: CreateAgencyClientDto) {
    const [, client] = await this.prisma.$transaction([
      this.prisma.organization.update({ where: { id: dto.organizationId }, data: { isAgency: true } }),
      this.prisma.agencyClient.create({ data: dto }),
    ]);
    return client;
  }

  async clientDetail(clientId: string) {
    const client = await this.prisma.agencyClient.findUnique({
      where: { id: clientId },
      include: {
        portalAccess: true,
        projects: {
          include: {
            project: {
              select: {
                id: true, name: true, slug: true, status: true, region: true, productionUrl: true,
                services: { where: { deletedAt: null }, select: { id: true, name: true, type: true, status: true } },
                domains: { where: { deletedAt: null }, select: { id: true, hostname: true, status: true, ssl: { select: { status: true, expiresAt: true } } } },
                deployments: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, createdAt: true } },
              },
            },
          },
        },
      },
    });
    if (!client) throw new NotFoundException("Agency client not found");
    return client;
  }

  async updateClient(clientId: string, dto: UpdateAgencyClientDto) {
    await this.assertClient(clientId);
    return this.prisma.agencyClient.update({ where: { id: clientId }, data: dto });
  }

  async assignProject(clientId: string, dto: AssignClientProjectDto) {
    const client = await this.assertClient(clientId);
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId }, select: { organizationId: true } });
    if (!project || project.organizationId !== client.organizationId) throw new BadRequestException("Project must belong to the agency workspace");
    return this.prisma.clientProject.upsert({
      where: { projectId: dto.projectId },
      create: { clientId, projectId: dto.projectId, monthlyCostCents: dto.monthlyCostCents ?? 0, monthlyRevenueCents: dto.monthlyRevenueCents ?? 0 },
      update: { clientId, monthlyCostCents: dto.monthlyCostCents, monthlyRevenueCents: dto.monthlyRevenueCents },
      include: { project: { select: { id: true, name: true, status: true } } },
    });
  }

  async removeProject(clientId: string, projectId: string) {
    await this.assertClient(clientId);
    await this.prisma.clientProject.deleteMany({ where: { clientId, projectId } });
    return { removed: true };
  }

  branding(organizationId: string) {
    return this.prisma.agencyBranding.findUnique({ where: { organizationId } });
  }

  updateBranding(dto: UpdateBrandingDto) {
    const { organizationId, ...data } = dto;
    return this.prisma.agencyBranding.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  }

  async updatePortalAccess(clientId: string, dto: UpdatePortalAccessDto) {
    await this.assertClient(clientId);
    return this.prisma.clientPortalAccess.upsert({ where: { clientId }, create: { clientId, ...dto }, update: dto });
  }

  private async assertClient(clientId: string) {
    const client = await this.prisma.agencyClient.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException("Agency client not found");
    return client;
  }
}
