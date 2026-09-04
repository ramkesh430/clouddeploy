import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OrgRole } from "@clouddeploy/database";
import { PrismaService } from "../prisma/prisma.service";
import { UsageService } from "../usage/usage.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { InviteMemberDto } from "./dto/invite-member.dto";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async listForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: { deletedAt: null, members: { some: { userId, status: "ACTIVE" } } },
      include: { _count: { select: { projects: true, members: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(userId: string, userEmail: string, dto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException("This workspace URL is already taken");
    }
    return this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        members: {
          create: { userId, email: userEmail, role: "OWNER", status: "ACTIVE", joinedAt: new Date() },
        },
      },
    });
  }

  async findOne(organizationId: string) {
    const org = await this.prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  async listMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true, lastLoginAt: true } } },
      orderBy: { invitedAt: "asc" },
    });
  }

  async inviteMember(organizationId: string, invitedBy: string, dto: InviteMemberDto) {
    const existing = await this.prisma.organizationMember.findUnique({
      where: { organizationId_email: { organizationId, email: dto.email.toLowerCase() } },
    });
    if (existing) {
      throw new ConflictException("This person is already a member or has a pending invite");
    }

    const memberLimit = await this.usage.checkLimit(organizationId, "teamMembers");
    if (!memberLimit.allowed) {
      throw new BadRequestException(
        `Your plan is limited to ${memberLimit.limit} team member${memberLimit.limit === 1 ? "" : "s"}. Upgrade to invite more.`,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });

    const member = await this.prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user?.id,
        email: dto.email.toLowerCase(),
        role: dto.role,
        status: "INVITED",
        invitedBy,
      },
    });

    await this.activityLog.log({
      organizationId,
      userId: invitedBy,
      action: "member.invited",
      resourceType: "OrganizationMember",
      resourceId: member.id,
    });
    return member;
  }

  async updateMemberRole(organizationId: string, memberId: string, newRole: OrgRole, actingUserId: string) {
    const member = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId } });
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "OWNER" && member.userId === actingUserId) {
      throw new ForbiddenException("The workspace owner cannot change their own role");
    }

    const updated = await this.prisma.organizationMember.update({ where: { id: memberId }, data: { role: newRole } });

    await this.activityLog.log({
      organizationId,
      userId: actingUserId,
      action: "member.role_changed",
      resourceType: "OrganizationMember",
      resourceId: memberId,
    });
    return updated;
  }

  async removeMember(organizationId: string, memberId: string, actingUserId: string) {
    const member = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId } });
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "OWNER" && member.userId === actingUserId) {
      throw new ForbiddenException("The workspace owner cannot remove themselves");
    }
    await this.prisma.organizationMember.delete({ where: { id: memberId } });
    return { removed: true };
  }
}
