import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    return this.prisma.project.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        repository: true,
        services: { select: { id: true, name: true, type: true, framework: true, status: true } },
        _count: { select: { services: true, deployments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(organizationId: string, createdBy: string, dto: CreateProjectDto) {
    const existing = await this.prisma.project.findUnique({
      where: { organizationId_slug: { organizationId, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException("A project with this slug already exists in this workspace");
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (subscription) {
      const activeCount = await this.prisma.project.count({ where: { organizationId, deletedAt: null } });
      if (activeCount >= subscription.plan.maxProjects) {
        throw new BadRequestException(
          `Your ${subscription.plan.name} plan is limited to ${subscription.plan.maxProjects} projects. Upgrade to create more.`,
        );
      }
    }

    return this.prisma.project.create({
      data: {
        organizationId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        region: dto.region ?? "us-east",
        createdBy,
      },
    });
  }

  async findOne(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        repository: true,
        services: true,
        domains: { include: { ssl: true } },
        deployments: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async update(projectId: string, dto: UpdateProjectDto) {
    await this.assertExists(projectId);
    return this.prisma.project.update({ where: { id: projectId }, data: dto });
  }

  async pause(projectId: string) {
    await this.assertExists(projectId);
    return this.prisma.project.update({ where: { id: projectId }, data: { status: "PAUSED" } });
  }

  async resume(projectId: string) {
    await this.assertExists(projectId);
    return this.prisma.project.update({ where: { id: projectId }, data: { status: "ACTIVE" } });
  }

  async archive(projectId: string) {
    await this.assertExists(projectId);
    return this.prisma.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } });
  }

  /** Soft delete — per spec, critical infrastructure is never hard-deleted without confirmation. */
  async remove(projectId: string) {
    await this.assertExists(projectId);
    return this.prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });
  }

  private async assertExists(projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }
}
