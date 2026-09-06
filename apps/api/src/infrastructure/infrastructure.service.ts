import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import crypto from "node:crypto";
import { NodeRole, Prisma, RiskEventType, RiskSeverity, ServerCommandType } from "@clouddeploy/database";
import { DetectedRisk, detectContainerRisks } from "@clouddeploy/deployment-core";
import { PrismaService } from "../prisma/prisma.service";
import { CompleteServerCommandDto, ContainerTelemetryDto, CreateRegionDto, RegisterServerDto, ServerActionDto, ServerHeartbeatDto } from "./dto/infrastructure.dto";
import { RoutingService } from "./routing.service";

// A container that keeps breaching the same risk stays OPEN rather than
// spawning a fresh row every ~15s heartbeat; only once this window has
// elapsed since the last one does the same containerId+type get a new event.
const RISK_EVENT_DEDUP_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class InfrastructureService {
  private readonly logger = new Logger("InfrastructureService");

  constructor(private readonly prisma: PrismaService, private readonly routing: RoutingService) {}

  regions(includeInactive = false) {
    return this.prisma.region.findMany({ where: includeInactive ? {} : { active: true }, orderBy: [{ continent: "asc" }, { name: "asc" }] });
  }

  createRegion(dto: CreateRegionDto) {
    return this.prisma.region.create({ data: dto });
  }

  updateRegion(regionId: string, data: Partial<CreateRegionDto> & { active?: boolean }) {
    return this.prisma.region.update({ where: { id: regionId }, data });
  }

  async dependencyWarnings(projectId: string, targetRegion?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { services: { where: { deletedAt: null }, include: { database: true, redisInstance: true } } },
    });
    if (!project) throw new NotFoundException("Project not found");
    const region = targetRegion ?? project.region;
    const warnings: string[] = [];
    for (const service of project.services) {
      if (service.database && service.database.region !== region) warnings.push(`${service.database.name} is in ${service.database.region}; cross-region database traffic adds latency and egress cost.`);
      if (service.redisInstance && service.redisInstance.region !== region) warnings.push(`${service.redisInstance.name} is in ${service.redisInstance.region}; Redis should normally be colocated with the application.`);
    }
    return { projectId, targetRegion: region, safe: warnings.length === 0, warnings };
  }

  async registerServer(dto: RegisterServerDto) {
    const region = await this.prisma.region.findUnique({ where: { code: dto.region } });
    if (!region?.active) throw new BadRequestException("Region is not active");
    const token = `cda_${crypto.randomBytes(32).toString("base64url")}`;
    const server = await this.prisma.server.create({ data: { ...dto, agentTokenHash: this.hash(token), lastHeartbeatAt: null } });
    if (dto.role === "RUNTIME_NODE") await this.prisma.runtimeNode.create({ data: { serverId: server.id, region: dto.region, totalCpuCores: dto.cpuCores, totalRamMb: dto.ramMb, totalDiskMb: dto.diskMb } });
    if (dto.role === "BUILD_WORKER") await this.prisma.buildWorker.create({ data: { serverId: server.id, region: dto.region } });
    if (dto.role === "DATABASE_NODE") await this.prisma.databaseNode.create({ data: { serverId: server.id, region: dto.region, totalStorageMb: dto.diskMb } });
    if (dto.role === "STORAGE_NODE") await this.prisma.storageNode.create({ data: { serverId: server.id, region: dto.region, totalStorageMb: dto.diskMb } });
    return { server, agentToken: token };
  }

  servers(role?: NodeRole) {
    return this.prisma.server.findMany({
      where: role ? { role } : {},
      include: { regionRecord: true, runtimeNode: true, buildWorker: true, databaseNode: true, storageNode: true, metrics: { orderBy: { timestamp: "desc" }, take: 1 } },
      orderBy: [{ region: "asc" }, { hostname: "asc" }],
    });
  }

  async capacity() {
    const servers = await this.prisma.server.findMany({ where: { status: { not: "DISABLED" } }, include: { runtimeNode: true, buildWorker: true, databaseNode: true, storageNode: true, metrics: { orderBy: { timestamp: "desc" }, take: 1 } } });
    const [currentContainers, currentDatabases] = await Promise.all([
      this.prisma.container.count({ where: { status: { in: ["CREATING", "RUNNING"] } } }),
      this.prisma.database.count({ where: { status: "RUNNING", deletedAt: null } }),
    ]);
    return {
      totalCpu: servers.reduce((sum, server) => sum + server.cpuCores, 0),
      usedCpu: servers.reduce((sum, server) => sum + (server.metrics[0]?.cpuPct ?? 0) * server.cpuCores / 100, 0),
      totalRamMb: servers.reduce((sum, server) => sum + server.ramMb, 0),
      usedRamMb: servers.reduce((sum, server) => sum + (server.metrics[0]?.ramPct ?? 0) * server.ramMb / 100, 0),
      totalDiskMb: servers.reduce((sum, server) => sum + server.diskMb, 0),
      usedDiskMb: servers.reduce((sum, server) => sum + (server.metrics[0]?.diskPct ?? 0) * server.diskMb / 100, 0),
      nodeCount: servers.length,
      currentContainers,
      currentDatabases,
      buildQueueDepth: servers.reduce((sum, server) => sum + (server.buildWorker?.currentBuilds ?? 0), 0),
    };
  }

  async action(serverId: string, dto: ServerActionDto) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundException("Server not found");
    const status = this.statusForAction(dto.action);
    const [updated, command] = await this.prisma.$transaction([
      this.prisma.server.update({ where: { id: serverId }, data: status ? { status, disabledReason: dto.action === "DISABLE" ? String(dto.payload?.reason ?? "Disabled by administrator") : undefined } : {} }),
      this.prisma.serverCommand.create({ data: { serverId, type: dto.action, payload: dto.payload as Prisma.InputJsonValue | undefined } }),
    ]);
    return { server: updated, command };
  }

  async heartbeat(token: string | undefined, dto: ServerHeartbeatDto) {
    const server = await this.authenticateAgent(token);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.server.update({ where: { id: server.id }, data: { lastHeartbeatAt: now, agentVersion: dto.agentVersion, status: server.status === "OFFLINE" ? "ONLINE" : undefined } });
      await tx.serverMetric.create({ data: { serverId: server.id, cpuPct: dto.cpuPct, ramPct: dto.ramPct, diskPct: dto.diskPct, containerCount: dto.containerCount ?? 0 } });
      if (server.role === "BUILD_WORKER") await tx.buildWorker.update({ where: { serverId: server.id }, data: { currentBuilds: dto.currentBuilds ?? 0 } });
      if (server.role === "DATABASE_NODE") await tx.databaseNode.update({ where: { serverId: server.id }, data: { databaseCount: dto.databaseCount ?? 0, activeConnections: dto.activeConnections ?? 0, backupHealthy: dto.backupHealthy ?? true, usedCpuPct: dto.cpuPct, usedRamPct: dto.ramPct } });
      if (server.role === "STORAGE_NODE") await tx.storageNode.update({ where: { serverId: server.id }, data: { objectCount: dto.objectCount ?? 0, replicationHealthy: dto.replicationHealthy ?? true } });
      for (const item of dto.containers ?? []) {
        await tx.container.updateMany({ where: { id: item.containerId, runtimeNode: { serverId: server.id } }, data: { status: item.status, healthy: item.healthy, privateIp: item.privateIp, lastHealthAt: now } });
      }
    });
    for (const item of dto.containers ?? []) {
      const container = await this.prisma.container.findUnique({ where: { id: item.containerId }, select: { serviceId: true } });
      if (container) await this.routing.syncService(container.serviceId);
    }

    if (dto.telemetry?.length) await this.processTelemetry(dto.telemetry);

    return { accepted: true, serverId: server.id, nextHeartbeatSeconds: 30 };
  }

  /** Turns raw, real per-container telemetry reported by a runtime-agent
   * into persisted RiskEvent rows, using the same detection policy the API
   * unit-tests independently (`detectContainerRisks`). Runs outside the
   * heartbeat's own transaction — a slow or failing risk write should never
   * fail the heartbeat itself, since the container health update already
   * committed. */
  private async processTelemetry(telemetry: ContainerTelemetryDto[]): Promise<void> {
    for (const sample of telemetry) {
      const container = await this.prisma.container.findUnique({
        where: { id: sample.containerId },
        include: { service: { include: { project: true } } },
      });
      if (!container) continue;

      await this.prisma.container.update({
        where: { id: container.id },
        data: { lastCpuPct: sample.cpuPct, lastRamPct: sample.ramPct, lastMetricAt: new Date() },
      });

      const risks = detectContainerRisks({
        containerId: container.id,
        cpuPct: sample.cpuPct,
        ramPct: sample.ramPct,
        processes: sample.processes ?? [],
        connections: sample.connections ?? [],
      });

      for (const risk of risks) {
        await this.recordRiskEvent(risk, {
          containerId: container.id,
          serviceId: container.serviceId,
          projectId: container.service.projectId,
          organizationId: container.service.project.organizationId,
        });
      }
    }
  }

  private async recordRiskEvent(
    risk: DetectedRisk,
    target: { containerId: string; serviceId: string; projectId: string; organizationId: string },
  ): Promise<void> {
    const recent = await this.prisma.riskEvent.findFirst({
      where: {
        containerId: target.containerId,
        type: risk.type as RiskEventType,
        status: { in: ["OPEN", "REVIEWING"] },
        createdAt: { gte: new Date(Date.now() - RISK_EVENT_DEDUP_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) return;

    await this.prisma.riskEvent.create({
      data: {
        organizationId: target.organizationId,
        projectId: target.projectId,
        serviceId: target.serviceId,
        containerId: target.containerId,
        type: risk.type as RiskEventType,
        severity: risk.severity as RiskSeverity,
        title: risk.title,
        evidence: risk.evidence as Prisma.InputJsonValue,
        recommendedActions: risk.recommendedActions,
      },
    });
    this.logger.warn(`Risk event ${risk.type} recorded for container ${target.containerId}: ${risk.title}`);
  }

  async pollCommands(token: string | undefined) {
    const server = await this.authenticateAgent(token);
    const commands = await this.prisma.serverCommand.findMany({ where: { serverId: server.id, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 20 });
    if (commands.length) await this.prisma.serverCommand.updateMany({ where: { id: { in: commands.map((command) => command.id) } }, data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() } });
    return commands;
  }

  async completeCommand(token: string | undefined, commandId: string, dto: CompleteServerCommandDto) {
    const server = await this.authenticateAgent(token);
    const command = await this.prisma.serverCommand.findFirst({ where: { id: commandId, serverId: server.id } });
    if (!command) throw new NotFoundException("Command not found");
    return this.prisma.serverCommand.update({ where: { id: commandId }, data: { status: dto.status, result: dto.result as Prisma.InputJsonValue | undefined, completedAt: new Date() } });
  }

  private async authenticateAgent(token?: string) {
    if (!token) throw new UnauthorizedException("Missing agent token");
    const server = await this.prisma.server.findUnique({ where: { agentTokenHash: this.hash(token) } });
    if (!server || server.status === "DISABLED") throw new UnauthorizedException("Invalid or disabled agent token");
    return server;
  }

  private hash(token: string) { return crypto.createHash("sha256").update(token).digest("hex"); }

  private statusForAction(action: ServerCommandType) {
    if (action === "DRAIN") return "DRAINING" as const;
    if (action === "ENTER_MAINTENANCE") return "MAINTENANCE" as const;
    if (action === "EXIT_MAINTENANCE") return "ONLINE" as const;
    if (action === "DISABLE" || action === "REMOVE") return "DISABLED" as const;
    return null;
  }
}
