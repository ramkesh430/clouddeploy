import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string) {
    const [
      totalProjects,
      runningServices,
      buildingServices,
      failedServices,
      databases,
      recentProjects,
      recentDeployments,
      storageUsageMb,
    ] = await Promise.all([
      this.prisma.project.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.service.count({ where: { project: { organizationId }, status: "RUNNING", deletedAt: null } }),
      this.prisma.service.count({ where: { project: { organizationId }, status: "BUILDING", deletedAt: null } }),
      this.prisma.service.count({ where: { project: { organizationId }, status: "FAILED", deletedAt: null } }),
      this.prisma.database.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.project.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          repository: true,
          services: { select: { framework: true, status: true }, take: 1 },
          deployments: { orderBy: { createdAt: "desc" }, take: 1 },
          domains: { where: { type: "PLATFORM" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      this.prisma.deployment.findMany({
        where: { project: { organizationId } },
        include: { project: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      this.prisma.database.aggregate({ where: { organizationId, deletedAt: null }, _sum: { storageUsedMb: true } }),
    ]);

    return {
      stats: {
        totalProjects,
        runningServices,
        buildingServices,
        failedServices,
        databases,
        storageUsedMb: storageUsageMb._sum.storageUsedMb ?? 0,
        monthlyBandwidthGb: 0,
        monthlyCostUsd: await this.estimateMonthlyCost(organizationId),
      },
      recentProjects: recentProjects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        repository: p.repository?.fullName ?? null,
        framework: p.services[0]?.framework ?? null,
        status: p.status,
        productionUrl: p.productionUrl ?? p.domains[0]?.hostname ?? null,
        lastDeployAt: p.deployments[0]?.createdAt ?? null,
      })),
      recentDeployments: recentDeployments.map((d) => ({
        id: d.id,
        project: d.project.name,
        projectSlug: d.project.slug,
        branch: d.branch,
        commitSha: d.commitSha,
        status: d.status,
        durationMs: d.durationMs,
        createdAt: d.createdAt,
      })),
      infrastructureHealth: {
        buildQueue: "operational",
        runtimeNodes: "operational",
        databases: "operational",
        objectStorage: "operational",
        ssl: "operational",
      },
    };
  }

  private async estimateMonthlyCost(organizationId: string): Promise<number> {
    const services = await this.prisma.service.findMany({
      where: { project: { organizationId }, deletedAt: null },
      select: { cpuCores: true, ramMb: true },
    });
    const databases = await this.prisma.database.findMany({
      where: { organizationId, deletedAt: null },
      select: { cpuCores: true, ramMb: true },
    });
    const allResources = [...services, ...databases];
    // Rough estimator: $4/CPU-core + $0.01/RAM-MB, mirroring the resource
    // preset pricing shown in the Review & Deploy screen.
    return allResources.reduce((sum, r) => sum + r.cpuCores * 4 + r.ramMb * 0.01, 0);
  }
}
