import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RoutingService } from "./routing.service";

@Injectable()
export class SchedulerService {
  constructor(private readonly prisma: PrismaService, private readonly routing: RoutingService) {}

  async chooseRuntimeNode(region: string, cpuCores: number, ramMb: number) {
    let nodes = await this.prisma.runtimeNode.findMany({
      where: {
        region,
        status: "ONLINE",
        server: { status: "ONLINE" },
      },
      include: { server: true },
    });
    if (nodes.length === 0 && process.env.NODE_ENV !== "production") {
      await this.ensureDevelopmentNode(region, "RUNTIME_NODE");
      nodes = await this.prisma.runtimeNode.findMany({ where: { region, status: "ONLINE", server: { status: "ONLINE" } }, include: { server: true } });
    }
    return nodes
      .filter((node) => node.totalCpuCores - node.usedCpuCores >= cpuCores && node.totalRamMb - node.usedRamMb >= ramMb)
      .sort((a, b) => (a.usedCpuCores / a.totalCpuCores + a.usedRamMb / a.totalRamMb) - (b.usedCpuCores / b.totalCpuCores + b.usedRamMb / b.totalRamMb))[0] ?? null;
  }

  async chooseBuildWorker(region: string) {
    let workers = await this.prisma.buildWorker.findMany({ where: { region, status: "ONLINE", server: { status: "ONLINE" } }, include: { server: true } });
    if (workers.length === 0 && process.env.NODE_ENV !== "production") {
      await this.ensureDevelopmentNode(region, "BUILD_WORKER");
      workers = await this.prisma.buildWorker.findMany({ where: { region, status: "ONLINE", server: { status: "ONLINE" } }, include: { server: true } });
    }
    return workers.filter((worker) => worker.currentBuilds < worker.maxConcurrentBuilds).sort((a, b) => a.currentBuilds - b.currentBuilds)[0] ?? null;
  }

  async reconcileServiceReplicas(serviceId: string, desiredCount: number, deploymentId?: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId }, include: { project: true } });
    if (!service) throw new ServiceUnavailableException("Service no longer exists");
    const existing = await this.prisma.container.findMany({ where: { serviceId, status: { not: "REMOVED" } }, orderBy: { replicaIndex: "asc" } });
    const boundedDesired = Math.max(0, desiredCount);

    if (existing.length < boundedDesired) {
      for (let index = existing.length; index < boundedDesired; index += 1) {
        const node = await this.chooseRuntimeNode(service.project.region, service.cpuCores, service.ramMb);
        if (!node) throw new ServiceUnavailableException(`No healthy runtime node in ${service.project.region} has enough CPU/RAM capacity`);
        const simulatedHealthy = process.env.NODE_ENV !== "production" && process.env.SIMULATE_RUNTIME !== "false";
        const container = await this.prisma.$transaction(async (tx) => {
          const created = await tx.container.create({
            data: {
              serviceId,
              deploymentId,
              runtimeNodeId: node.id,
              replicaIndex: index,
              cpuCores: service.cpuCores,
              ramMb: service.ramMb,
              status: simulatedHealthy ? "RUNNING" : "CREATING",
              healthy: simulatedHealthy,
              privateIp: simulatedHealthy ? node.server.ipAddress : null,
              startedAt: simulatedHealthy ? new Date() : null,
              lastHealthAt: simulatedHealthy ? new Date() : null,
            },
          });
          await tx.runtimeNode.update({
            where: { id: node.id },
            data: { usedCpuCores: { increment: service.cpuCores }, usedRamMb: { increment: service.ramMb }, containerCount: { increment: 1 } },
          });
          await tx.serverCommand.create({ data: { serverId: node.serverId, type: "RECONCILE_SERVICE", payload: { serviceId, containerId: created.id, replicaIndex: index } } });
          return created;
        });
        existing.push(container);
      }
    } else if (existing.length > boundedDesired) {
      const victims = [...existing].sort((a, b) => b.replicaIndex - a.replicaIndex).slice(0, existing.length - boundedDesired);
      for (const container of victims) {
        await this.prisma.$transaction(async (tx) => {
          await tx.container.update({ where: { id: container.id }, data: { status: "REMOVED", healthy: false, stoppedAt: new Date() } });
          if (container.runtimeNodeId) {
            const node = await tx.runtimeNode.findUnique({ where: { id: container.runtimeNodeId } });
            if (node) {
              await tx.runtimeNode.update({
                where: { id: node.id },
                data: {
                  usedCpuCores: Math.max(0, node.usedCpuCores - container.cpuCores),
                  usedRamMb: Math.max(0, node.usedRamMb - container.ramMb),
                  containerCount: Math.max(0, node.containerCount - 1),
                },
              });
              await tx.serverCommand.create({ data: { serverId: node.serverId, type: "TERMINATE_CONTAINER", payload: { containerId: container.id } } });
            }
          }
        });
      }
    }

    await this.prisma.service.update({ where: { id: serviceId }, data: { instances: boundedDesired } });
    return this.routing.syncService(serviceId);
  }

  private async ensureDevelopmentNode(region: string, role: "RUNTIME_NODE" | "BUILD_WORKER") {
    const suffix = role === "RUNTIME_NODE" ? "runtime" : "builder";
    const server = await this.prisma.server.upsert({
      where: { hostname: `local-${suffix}-${region}` },
      create: { hostname: `local-${suffix}-${region}`, ipAddress: "127.0.0.1", region, role, cpuCores: 16, ramMb: 32768, diskMb: 262144, lastHeartbeatAt: new Date() },
      update: { status: "ONLINE" },
    });
    if (role === "RUNTIME_NODE") {
      await this.prisma.runtimeNode.upsert({ where: { serverId: server.id }, create: { serverId: server.id, region, totalCpuCores: server.cpuCores, totalRamMb: server.ramMb, totalDiskMb: server.diskMb }, update: { status: "ONLINE" } });
    } else {
      await this.prisma.buildWorker.upsert({ where: { serverId: server.id }, create: { serverId: server.id, region }, update: { status: "ONLINE" } });
    }
  }
}
