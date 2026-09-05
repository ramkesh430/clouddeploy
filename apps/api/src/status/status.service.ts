import { Injectable, NotFoundException } from "@nestjs/common";
import { IncidentSeverity, PublicServiceStatus } from "@clouddeploy/database";
import { PrismaService } from "../prisma/prisma.service";
import { CreateIncidentDto, IncidentUpdateDto, UpdatePlatformServiceDto } from "./dto/status.dto";

@Injectable()
export class StatusService {
  constructor(private readonly prisma: PrismaService) {}

  async publicStatus() {
    const [services, incidents] = await Promise.all([
      this.prisma.platformService.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      this.prisma.incident.findMany({
        where: { OR: [{ status: { not: "RESOLVED" } }, { resolvedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } }] },
        include: { services: { include: { service: true } }, updates: { orderBy: { createdAt: "desc" } } },
        orderBy: { startedAt: "desc" },
      }),
    ]);
    const operational = services.length > 0 && services.every((service) => service.status === "OPERATIONAL");
    return { overall: operational ? "OPERATIONAL" : this.worstStatus(services.map((service) => service.status)), services, incidents, generatedAt: new Date() };
  }

  services() { return this.prisma.platformService.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }); }

  updateService(serviceId: string, dto: UpdatePlatformServiceDto) { return this.prisma.platformService.update({ where: { id: serviceId }, data: dto }); }

  incidents() {
    return this.prisma.incident.findMany({ include: { services: { include: { service: true } }, updates: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } } }, orderBy: { startedAt: "desc" }, take: 200 });
  }

  async createIncident(dto: CreateIncidentDto, adminId: string) {
    const incident = await this.prisma.incident.create({
      data: { title: dto.title, severity: dto.severity, description: dto.description, createdById: adminId, services: { create: dto.serviceIds.map((serviceId) => ({ serviceId })) }, updates: { create: { authorId: adminId, status: "INVESTIGATING", message: dto.description } } },
      include: { services: { include: { service: true } }, updates: true },
    });
    await this.setAffectedStatus(dto.serviceIds, this.statusForSeverity(dto.severity));
    return incident;
  }

  async addUpdate(incidentId: string, dto: IncidentUpdateDto, adminId: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId }, include: { services: true } });
    if (!incident) throw new NotFoundException("Incident not found");
    const resolvedAt = dto.status === "RESOLVED" ? new Date() : null;
    const [update] = await this.prisma.$transaction([
      this.prisma.incidentUpdate.create({ data: { incidentId, authorId: adminId, status: dto.status, message: dto.message } }),
      this.prisma.incident.update({ where: { id: incidentId }, data: { status: dto.status, resolvedAt } }),
    ]);
    for (const relation of incident.services) await this.recomputeServiceStatus(relation.serviceId);
    return update;
  }

  private async recomputeServiceStatus(serviceId: string) {
    const active = await this.prisma.incidentService.findMany({ where: { serviceId, incident: { status: { not: "RESOLVED" } } }, include: { incident: true } });
    const status = active.length ? this.worstStatus(active.map((item) => this.statusForSeverity(item.incident.severity))) : "OPERATIONAL";
    await this.prisma.platformService.update({ where: { id: serviceId }, data: { status } });
  }

  private setAffectedStatus(ids: string[], status: PublicServiceStatus) { return this.prisma.platformService.updateMany({ where: { id: { in: ids } }, data: { status } }); }
  private statusForSeverity(severity: IncidentSeverity): PublicServiceStatus { return severity === "CRITICAL" ? "MAJOR_OUTAGE" : severity === "MAJOR" ? "PARTIAL_OUTAGE" : "DEGRADED"; }
  private worstStatus(statuses: PublicServiceStatus[]): PublicServiceStatus {
    const order: PublicServiceStatus[] = ["OPERATIONAL", "MAINTENANCE", "DEGRADED", "PARTIAL_OUTAGE", "MAJOR_OUTAGE"];
    return statuses.reduce((worst, status) => order.indexOf(status) > order.indexOf(worst) ? status : worst, "OPERATIONAL" as PublicServiceStatus);
  }
}
