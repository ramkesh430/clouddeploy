import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const [users, organizations, projects, runningContainers, activeDatabases, failedDeployments, buildQueue, revenue, capacity] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.project.count({ where: { deletedAt: null } }),
      this.prisma.container.count({ where: { status: "RUNNING" } }),
      this.prisma.database.count({ where: { status: "RUNNING", deletedAt: null } }),
      this.prisma.deployment.count({ where: { status: "FAILED", createdAt: { gte: monthStart } } }),
      this.prisma.buildWorker.aggregate({ _sum: { currentBuilds: true } }),
      this.prisma.invoice.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { amountPaidCents: true } }),
      this.prisma.server.findMany({ where: { status: { not: "DISABLED" } }, include: { metrics: { orderBy: { timestamp: "desc" }, take: 1 } } }),
    ]);
    return {
      users, organizations, projects, runningContainers, activeDatabases, failedDeployments,
      buildQueue: buildQueue._sum.currentBuilds ?? 0,
      monthlyRevenueCents: revenue._sum.amountPaidCents ?? 0,
      cpuCapacity: { total: capacity.reduce((sum, server) => sum + server.cpuCores, 0), used: capacity.reduce((sum, server) => sum + server.cpuCores * (server.metrics[0]?.cpuPct ?? 0) / 100, 0) },
      ramCapacityMb: { total: capacity.reduce((sum, server) => sum + server.ramMb, 0), used: capacity.reduce((sum, server) => sum + server.ramMb * (server.metrics[0]?.ramPct ?? 0) / 100, 0) },
      storageUsedMb: capacity.reduce((sum, server) => sum + server.diskMb * (server.metrics[0]?.diskPct ?? 0) / 100, 0),
      bandwidthBytes: String((await this.prisma.usageRecord.aggregate({ where: { metricType: "bandwidth" }, _sum: { quantity: true } }))._sum.quantity ?? 0),
    };
  }

  async analytics(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [subscriptions, canceled, newUsers, activeOrganizations, projectsCreated, deployments, failedDeployments, buildDuration, bandwidth, storage] = await Promise.all([
      this.prisma.subscription.findMany({ where: { status: { in: ["ACTIVE", "TRIALING"] } }, include: { plan: true } }),
      this.prisma.subscription.count({ where: { status: "CANCELED", updatedAt: { gte: since } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      this.prisma.organization.count({ where: { deletedAt: null, projects: { some: { updatedAt: { gte: since } } } } }),
      this.prisma.project.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      this.prisma.deployment.count({ where: { createdAt: { gte: since } } }),
      this.prisma.deployment.count({ where: { createdAt: { gte: since }, status: "FAILED" } }),
      this.prisma.build.aggregate({ where: { createdAt: { gte: since }, durationMs: { not: null } }, _avg: { durationMs: true } }),
      this.prisma.usageRecord.aggregate({ where: { metricType: "bandwidth", periodStart: { gte: since } }, _sum: { quantity: true } }),
      this.prisma.usageRecord.aggregate({ where: { metricType: "storage", periodStart: { gte: since } }, _sum: { quantity: true } }),
    ]);
    const mrrCents = subscriptions.reduce((sum, subscription) => sum + (subscription.billingPeriod === "yearly" ? Math.round(subscription.plan.priceYearlyCents / 12) : subscription.plan.priceMonthlyCents), 0);
    return {
      periodDays: days,
      mrrCents,
      arrCents: mrrCents * 12,
      churnPct: subscriptions.length + canceled ? canceled / (subscriptions.length + canceled) * 100 : 0,
      newUsers,
      activeOrganizations,
      projectsCreated,
      deployments,
      failedDeploymentRatePct: deployments ? failedDeployments / deployments * 100 : 0,
      averageBuildDurationMs: buildDuration._avg.durationMs ?? 0,
      bandwidthGrowth: bandwidth._sum.quantity ?? 0,
      storageGrowth: storage._sum.quantity ?? 0,
    };
  }

  users(take = 50, cursor?: string) {
    return this.prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, email: true, fullName: true, isPlatformAdmin: true, isSuspended: true, suspendedReason: true, twoFactorEnabled: true, lastLoginAt: true, createdAt: true, _count: { select: { organizationMembers: true } } }, orderBy: { createdAt: "desc" }, take, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  }

  organizations(take = 50, cursor?: string) {
    return this.prisma.organization.findMany({ where: { deletedAt: null }, include: { subscription: { include: { plan: true } }, _count: { select: { members: true, projects: true, databases: true } } }, orderBy: { createdAt: "desc" }, take, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  }

  projects(take = 50, cursor?: string) {
    return this.prisma.project.findMany({ where: { deletedAt: null }, include: { organization: { select: { id: true, name: true } }, _count: { select: { services: true, deployments: true } } }, orderBy: { createdAt: "desc" }, take, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  }

  deployments(take = 50) { return this.prisma.deployment.findMany({ include: { project: { select: { id: true, name: true, organizationId: true } }, service: { select: { name: true } }, build: true }, orderBy: { createdAt: "desc" }, take }); }
  databases(take = 50) { return this.prisma.database.findMany({ where: { deletedAt: null }, select: { id: true, name: true, engine: true, status: true, region: true, cpuCores: true, ramMb: true, storageMb: true, storageUsedMb: true, createdAt: true, organization: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take }); }
  containers(take = 100) { return this.prisma.container.findMany({ include: { service: { select: { id: true, name: true, project: { select: { id: true, name: true, organizationId: true } } } }, runtimeNode: { include: { server: { select: { hostname: true } } } } }, orderBy: { createdAt: "desc" }, take }); }
  domains(take = 100) { return this.prisma.domain.findMany({ where: { deletedAt: null }, include: { organization: { select: { name: true } }, project: { select: { name: true } }, ssl: true }, orderBy: { createdAt: "desc" }, take }); }
  plans() { return this.prisma.plan.findMany({ include: { _count: { select: { subscriptions: true } } }, orderBy: { priceMonthlyCents: "asc" } }); }
  subscriptions(take = 100) { return this.prisma.subscription.findMany({ include: { organization: { select: { name: true } }, plan: true }, orderBy: { createdAt: "desc" }, take }); }
  transactions(take = 50) { return this.prisma.payment.findMany({ include: { invoice: { include: { organization: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take }); }
  usage(take = 100) { return this.prisma.usageRecord.findMany({ include: { organization: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take }); }
  logs(take = 100) { return this.prisma.auditLog.findMany({ include: { user: { select: { email: true } }, organization: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take }); }

  async security() {
    const [twoFactorUsers, suspiciousLogins, activeApiKeys, ipRestrictedKeys, ssoOrganizations, recentSecretAccess] = await Promise.all([
      this.prisma.user.count({ where: { twoFactorEnabled: true, deletedAt: null } }),
      this.prisma.loginEvent.count({ where: { suspicious: true, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      this.prisma.aPIKey.count({ where: { revokedAt: null } }),
      this.prisma.aPIKey.count({ where: { revokedAt: null, allowedIpRanges: { isEmpty: false } } }),
      this.prisma.organizationSsoConfig.count({ where: { enforced: true } }),
      this.prisma.secretAccessAudit.findMany({ include: { user: { select: { email: true } }, secret: { select: { scope: true, key: true } } }, orderBy: { createdAt: "desc" }, take: 25 }),
    ]);
    return { twoFactorUsers, suspiciousLogins, activeApiKeys, ipRestrictedKeys, ssoOrganizations, recentSecretAccess };
  }

  async suspendUser(userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return this.prisma.user.update({ where: { id: userId }, data: { isSuspended: true, suspendedReason: reason } });
  }

  resumeUser(userId: string) { return this.prisma.user.update({ where: { id: userId }, data: { isSuspended: false, suspendedReason: null } }); }
}
