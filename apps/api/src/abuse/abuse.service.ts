import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@clouddeploy/database";
import { PrismaService } from "../prisma/prisma.service";
import { AbuseAction, ApplyAbuseActionDto, CreateAbuseReportDto, CreateRiskEventDto } from "./dto/abuse.dto";

@Injectable()
export class AbuseService {
  constructor(private readonly prisma: PrismaService) {}

  createReport(dto: CreateAbuseReportDto, userId: string) {
    return this.prisma.abuseReport.create({ data: { ...dto, reportedBy: userId } });
  }

  reports(status?: string) {
    return this.prisma.abuseReport.findMany({ where: status ? { status: status as never } : {}, include: { organization: { select: { id: true, name: true, slug: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  }

  events(status?: string) {
    return this.prisma.riskEvent.findMany({ where: status ? { status: status as never } : {}, include: { organization: { select: { id: true, name: true } }, project: { select: { id: true, name: true, status: true } }, service: { select: { id: true, name: true, status: true } }, container: { select: { id: true, dockerId: true, replicaIndex: true, lastCpuPct: true, lastRamPct: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  }

  createRiskEvent(dto: CreateRiskEventDto) {
    return this.prisma.riskEvent.create({ data: { ...dto, evidence: dto.evidence as Prisma.InputJsonValue } });
  }

  async applyAction(eventId: string, dto: ApplyAbuseActionDto, adminId: string) {
    const event = await this.prisma.riskEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Risk event not found");
    const reason = dto.reason ?? `${event.type}: ${event.title}`;

    if (dto.action === AbuseAction.TERMINATE_CONTAINERS) {
      if (!event.serviceId && !event.projectId) throw new BadRequestException("Risk event has no service or project target");
      await this.prisma.container.updateMany({ where: event.serviceId ? { serviceId: event.serviceId } : { service: { projectId: event.projectId! } }, data: { status: "STOPPED", healthy: false, stoppedAt: new Date() } });
    }
    if (dto.action === AbuseAction.SUSPEND_PROJECT) {
      if (!event.projectId) throw new BadRequestException("Risk event has no project target");
      await this.prisma.$transaction([
        this.prisma.project.update({ where: { id: event.projectId }, data: { status: "PAUSED", suspendedAt: new Date(), suspendedReason: reason } }),
        this.prisma.service.updateMany({ where: { projectId: event.projectId }, data: { status: "PAUSED" } }),
        this.prisma.container.updateMany({ where: { service: { projectId: event.projectId } }, data: { status: "STOPPED", healthy: false, stoppedAt: new Date() } }),
      ]);
    }
    if (dto.action === AbuseAction.REINSTATE_PROJECT) {
      if (!event.projectId) throw new BadRequestException("Risk event has no project target");
      await this.prisma.project.update({ where: { id: event.projectId }, data: { status: "ACTIVE", suspendedAt: null, suspendedReason: null } });
    }
    if (dto.action === AbuseAction.SUSPEND_USER) {
      if (!dto.targetUserId) throw new BadRequestException("targetUserId is required");
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: dto.targetUserId }, data: { isSuspended: true, suspendedReason: reason } }),
        this.prisma.session.updateMany({ where: { userId: dto.targetUserId, revokedAt: null }, data: { revokedAt: new Date() } }),
      ]);
    }
    if (dto.action === AbuseAction.REINSTATE_USER) {
      if (!dto.targetUserId) throw new BadRequestException("targetUserId is required");
      await this.prisma.user.update({ where: { id: dto.targetUserId }, data: { isSuspended: false, suspendedReason: null } });
    }

    const status = dto.action === AbuseAction.DISMISS ? "DISMISSED" : dto.action === AbuseAction.MANUAL_REVIEW ? "REVIEWING" : "MITIGATED";
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.riskEvent.update({ where: { id: eventId }, data: { status, actionTaken: dto.action, reviewedById: adminId, reviewedAt: new Date() } });
      await tx.auditLog.create({ data: { organizationId: event.organizationId, userId: adminId, action: `abuse.${dto.action.toLowerCase()}`, resourceType: "RiskEvent", resourceId: eventId, newValue: { reason, action: dto.action } } });
      return updated;
    });
  }
}
