import { Injectable, NotFoundException } from "@nestjs/common";
import { RESOURCE_PRESETS } from "@clouddeploy/types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
import { WebhooksService } from "../webhooks/webhooks.service";

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
  ) {}

  async listByProject(projectId: string) {
    return this.prisma.service.findMany({
      where: { projectId, deletedAt: null },
      include: {
        redisInstance: { select: { id: true } },
        database: { select: { id: true } },
        worker: { select: { id: true, queueName: true, concurrency: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async listWorkers(projectId: string) {
    return this.prisma.service.findMany({
      where: { projectId, deletedAt: null, type: "WORKER" },
      include: { worker: true, deployments: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(dto: CreateServiceDto) {
    const preset = RESOURCE_PRESETS.find((p) => p.id === (dto.resourcePreset ?? "starter"))!;
    // WORKER services are background processes, never web-facing — no port,
    // no health check path, no public URL is ever assigned to them (the
    // deployment pipeline only ever sets Project.productionUrl, not a
    // per-service URL, so this is a real invariant, not just a default).
    const isWorker = dto.type === "WORKER";

    const service = await this.prisma.service.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        type: dto.type,
        runtime: dto.runtime ?? "NODE",
        framework: dto.framework ?? "UNKNOWN",
        rootDirectory: dto.rootDirectory ?? ".",
        branch: dto.branch ?? "main",
        buildCommand: dto.buildCommand,
        startCommand: dto.startCommand,
        port: isWorker ? undefined : dto.port,
        healthCheckPath: isWorker ? undefined : (dto.healthCheckPath ?? "/"),
        isPrivate: isWorker ? true : undefined,
        cpuCores: preset.cpuCores,
        ramMb: preset.ramMb,
        diskMb: preset.diskMb,
        internalHostname: `${dto.name}.internal`,
        status: "QUEUED",
      },
    });

    if (isWorker) {
      await this.prisma.worker.create({
        data: { serviceId: service.id, queueName: dto.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), concurrency: 1 },
      });
    }

    return service;
  }

  async findOne(serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, deletedAt: null },
      include: { deployments: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    if (!service) throw new NotFoundException("Service not found");
    return service;
  }

  async update(serviceId: string, dto: UpdateServiceDto) {
    await this.assertExists(serviceId);
    return this.prisma.service.update({
      where: { id: serviceId },
      data: {
        name: dto.name,
        rootDirectory: dto.rootDirectory,
        branch: dto.branch,
        buildCommand: dto.buildCommand,
        startCommand: dto.startCommand,
        port: dto.port,
        healthCheckPath: dto.healthCheckPath,
        runtime: dto.runtime,
        framework: dto.framework,
      },
    });
  }

  async restart(serviceId: string) {
    const service = await this.assertExists(serviceId);
    const updated = await this.prisma.service.update({
      where: { id: serviceId },
      data: { status: "RUNNING", crashCount: 0 },
    });
    const project = await this.prisma.project.findUnique({ where: { id: service.projectId }, select: { organizationId: true } });
    if (project) {
      await this.webhooks.dispatch(
        project.organizationId,
        "service.restarted",
        { serviceId, serviceName: service.name },
        service.projectId,
      );
    }
    return updated;
  }

  async remove(serviceId: string) {
    await this.assertExists(serviceId);
    return this.prisma.service.update({ where: { id: serviceId }, data: { deletedAt: new Date() } });
  }

  private async assertExists(serviceId: string) {
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, deletedAt: null } });
    if (!service) throw new NotFoundException("Service not found");
    return service;
  }
}
