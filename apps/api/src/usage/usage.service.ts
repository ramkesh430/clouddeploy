import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_LIMITS = {
  maxProjects: 1,
  maxRamMb: 512,
  maxDatabases: 0,
  maxTeamMembers: 1,
  maxStorageGb: 1,
  maxBuildMinutes: 100,
  maxBandwidthGb: 10,
};

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes an audit-trail usage snapshot. Read-side (getSummary) computes
   * live totals directly rather than aggregating these historically, since
   * there's no real metering (CPU/bandwidth) to aggregate yet — this table
   * exists so that pipeline is a pure addition later, not a redesign. */
  async record(organizationId: string, metricType: string, quantity: number, unit: string) {
    const now = new Date();
    return this.prisma.usageRecord.create({
      data: { organizationId, metricType, quantity, unit, periodStart: now, periodEnd: now },
    });
  }

  async getSummary(organizationId: string) {
    const [subscription, projectCount, databases, services, buckets, memberCount] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } }),
      this.prisma.project.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.database.findMany({ where: { organizationId, deletedAt: null }, select: { storageUsedMb: true } }),
      this.prisma.service.findMany({
        where: { project: { organizationId }, deletedAt: null },
        select: { ramMb: true },
      }),
      this.prisma.storageBucket.findMany({
        where: { organizationId },
        include: { objects: { select: { sizeBytes: true } } },
      }),
      this.prisma.organizationMember.count({ where: { organizationId, status: { in: ["ACTIVE", "INVITED"] } } }),
    ]);

    const features = (subscription?.plan.features as Record<string, unknown>) ?? {};
    const limits = {
      maxProjects: subscription?.plan.maxProjects ?? DEFAULT_LIMITS.maxProjects,
      maxRamMb: subscription?.plan.maxRamMb ?? DEFAULT_LIMITS.maxRamMb,
      maxDatabases: (features.maxDatabases as number) ?? DEFAULT_LIMITS.maxDatabases,
      maxTeamMembers: (features.maxTeamMembers as number) ?? DEFAULT_LIMITS.maxTeamMembers,
      maxStorageGb: (features.maxStorageGb as number) ?? DEFAULT_LIMITS.maxStorageGb,
      maxBuildMinutes: (features.maxBuildMinutes as number) ?? DEFAULT_LIMITS.maxBuildMinutes,
      maxBandwidthGb: (features.maxBandwidthGb as number) ?? DEFAULT_LIMITS.maxBandwidthGb,
    };

    const totalRamMb = services.reduce((sum, s) => sum + s.ramMb, 0);
    const totalDbStorageMb = databases.reduce((sum, d) => sum + d.storageUsedMb, 0);
    const totalObjectStorageBytes = buckets.reduce(
      (sum, b) => sum + b.objects.reduce((s, o) => s + Number(o.sizeBytes), 0),
      0,
    );
    const totalStorageGb = totalDbStorageMb / 1024 + totalObjectStorageBytes / 1024 / 1024 / 1024;

    // Build minutes and bandwidth aren't metered by a real runtime yet —
    // reported as recorded historical usage (sum of UsageRecord rows) so
    // the numbers are honest zeros until that pipeline exists, rather than
    // fabricated non-zero figures.
    const [buildMinutes, bandwidthGb] = await Promise.all([
      this.sumUsage(organizationId, "build_minutes"),
      this.sumUsage(organizationId, "bandwidth_gb"),
    ]);

    return {
      plan: subscription?.plan.name ?? "Free",
      limits,
      usage: {
        projects: projectCount,
        ramMb: totalRamMb,
        databases: databases.length,
        teamMembers: memberCount,
        storageGb: Number(totalStorageGb.toFixed(3)),
        buildMinutes,
        bandwidthGb,
      },
    };
  }

  async checkLimit(organizationId: string, kind: "projects" | "databases" | "teamMembers"): Promise<{ allowed: boolean; limit: number; current: number }> {
    const summary = await this.getSummary(organizationId);
    const map = {
      projects: { current: summary.usage.projects, limit: summary.limits.maxProjects },
      databases: { current: summary.usage.databases, limit: summary.limits.maxDatabases },
      teamMembers: { current: summary.usage.teamMembers, limit: summary.limits.maxTeamMembers },
    };
    const { current, limit } = map[kind];
    return { allowed: current < limit, limit, current };
  }

  private async sumUsage(organizationId: string, metricType: string): Promise<number> {
    const result = await this.prisma.usageRecord.aggregate({
      where: { organizationId, metricType },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }
}
