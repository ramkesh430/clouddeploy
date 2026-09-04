import { Injectable, NotFoundException } from "@nestjs/common";
import { RESOURCE_PRESETS } from "@clouddeploy/types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listByProject(projectId: string) {
    return this.prisma.service.findMany({
      where: { projectId, deletedAt: null },
      include: { redisInstance: { select: { id: true } }, database: { select: { id: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(dto: CreateServiceDto) {
    const preset = RESOURCE_PRESETS.find((p) => p.id === (dto.resourcePreset ?? "starter"))!;
    return this.prisma.service.create({
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
        port: dto.port,
        healthCheckPath: dto.healthCheckPath ?? "/",
        cpuCores: preset.cpuCores,
        ramMb: preset.ramMb,
        diskMb: preset.diskMb,
        internalHostname: `${dto.name}.internal`,
        status: "QUEUED",
      },
    });
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
    await this.assertExists(serviceId);
    return this.prisma.service.update({
      where: { id: serviceId },
      data: { status: "RUNNING", crashCount: 0 },
    });
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
