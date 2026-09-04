import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UsageService } from "../usage/usage.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  /**
   * OWNER/ADMIN/BILLING_MANAGER see every project in the workspace. A
   * DEVELOPER or VIEWER only sees projects they created or were explicitly
   * granted access to via ProjectMember — this is the actual behavioral
   * difference "project-level access" makes; without it, org-level roles
   * alone would give every developer visibility into every project.
   */
  async list(organizationId: string, requestingUserId?: string, requestingOrgRole?: string) {
    const restrictToGrantedProjects = requestingUserId && requestingOrgRole && ["DEVELOPER", "VIEWER"].includes(requestingOrgRole);

    return this.prisma.project.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(restrictToGrantedProjects
          ? { OR: [{ createdBy: requestingUserId }, { members: { some: { userId: requestingUserId } } }] }
          : {}),
      },
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

    const projectLimit = await this.usage.checkLimit(organizationId, "projects");
    if (!projectLimit.allowed) {
      throw new BadRequestException(
        `Your plan is limited to ${projectLimit.limit} project${projectLimit.limit === 1 ? "" : "s"}. Upgrade to create more.`,
      );
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

  async findOne(projectId: string, requestingUserId?: string, requestingOrgRole?: string) {
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

    if (requestingUserId && requestingOrgRole && ["DEVELOPER", "VIEWER"].includes(requestingOrgRole)) {
      const hasAccess =
        project.createdBy === requestingUserId ||
        (await this.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: requestingUserId } },
        })) !== null;
      if (!hasAccess) {
        throw new NotFoundException("Project not found");
      }
    }

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

  async listMembers(projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async addMember(projectId: string, userId: string) {
    await this.assertExists(projectId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId },
      update: {},
    });
  }

  async removeMember(projectId: string, memberId: string) {
    const member = await this.prisma.projectMember.findFirst({ where: { id: memberId, projectId } });
    if (!member) throw new NotFoundException("Project member not found");
    await this.prisma.projectMember.delete({ where: { id: memberId } });
    return { removed: true };
  }

  private async assertExists(projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }
}
