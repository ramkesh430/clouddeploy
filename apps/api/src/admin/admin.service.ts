import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@clouddeploy/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [users, organizations, projects, runningContainers, activeDatabases, failedDeployments, buildQueue, revenue, capacity, bandwidthUsedGb, activeSubscriptions, deploymentGroups] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.project.count({ where: { deletedAt: null } }),
      this.prisma.container.count({ where: { status: "RUNNING" } }),
      this.prisma.database.count({ where: { status: "RUNNING", deletedAt: null } }),
      this.prisma.deployment.count({ where: { status: "FAILED", createdAt: { gte: monthStart } } }),
      this.prisma.buildWorker.aggregate({ _sum: { currentBuilds: true } }),
      this.prisma.invoice.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { amountPaidCents: true } }),
      this.prisma.server.findMany({ where: { status: { not: "DISABLED" } }, include: { metrics: { orderBy: { timestamp: "desc" }, take: 1 } } }),
      // The real metric type usage.service.ts actually writes is "bandwidth_gb" —
      // this used to query the never-written "bandwidth" key and so always read 0.
      this.prisma.usageRecord.aggregate({ where: { metricType: "bandwidth_gb" }, _sum: { quantity: true } }),
      this.prisma.subscription.findMany({ where: { status: { in: ["ACTIVE", "TRIALING"] } }, include: { plan: { select: { features: true } } } }),
      this.prisma.deployment.groupBy({ by: ["status"], where: { createdAt: { gte: thirtyDaysAgo } }, _count: true }),
    ]);

    const runningStatuses = new Set(["CLONING", "BUILDING", "UPLOADING", "DEPLOYING", "HEALTH_CHECK"]);
    const deployments30d = deploymentGroups.reduce(
      (acc, g) => {
        acc.total += g._count;
        if (g.status === "LIVE") acc.succeeded += g._count;
        else if (g.status === "QUEUED") acc.queued += g._count;
        else if (runningStatuses.has(g.status)) acc.running += g._count;
        else acc.failed += g._count; // FAILED, CANCELLED, ROLLED_BACK
        return acc;
      },
      { total: 0, succeeded: 0, failed: 0, running: 0, queued: 0 },
    );

    // Bandwidth isn't metered by a real collector yet (see KNOWN_LIMITATIONS.md)
    // — "used" is genuinely 0 rather than fabricated, but "total" is a real
    // number: the sum of every active subscription's plan bandwidth entitlement.
    const bandwidthEntitledGb = activeSubscriptions.reduce((sum, sub) => {
      const features = sub.plan.features as Record<string, unknown>;
      const cap = typeof features.maxBandwidthGb === "number" ? features.maxBandwidthGb : 0;
      return sum + cap;
    }, 0);

    return {
      users, organizations, projects, runningContainers, activeDatabases, failedDeployments,
      buildQueue: buildQueue._sum.currentBuilds ?? 0,
      monthlyRevenueCents: revenue._sum.amountPaidCents ?? 0,
      cpuCapacity: { total: capacity.reduce((sum, server) => sum + server.cpuCores, 0), used: capacity.reduce((sum, server) => sum + server.cpuCores * (server.metrics[0]?.cpuPct ?? 0) / 100, 0) },
      ramCapacityMb: { total: capacity.reduce((sum, server) => sum + server.ramMb, 0), used: capacity.reduce((sum, server) => sum + server.ramMb * (server.metrics[0]?.ramPct ?? 0) / 100, 0) },
      storageCapacityMb: { total: capacity.reduce((sum, server) => sum + server.diskMb, 0), used: capacity.reduce((sum, server) => sum + server.diskMb * (server.metrics[0]?.diskPct ?? 0) / 100, 0) },
      bandwidthCapacityGb: { total: bandwidthEntitledGb, used: bandwidthUsedGb._sum.quantity ?? 0 },
      deployments30d,
    };
  }

  /** Real, day-bucketed cumulative growth series for the admin dashboard's
   * chart — computed from actual createdAt/paidAt timestamps, not a
   * fabricated curve. Starts from the real count as of `since` and adds
   * each day's real new rows to build a genuine running total. */
  async growth(metric: "users" | "organizations" | "projects" | "deployments" | "revenue", days: number) {
    // `days` points ending *today* — (days - 1) full days back from today's
    // midnight, so the loop below (i = 0..days-1) lands its last point on
    // today rather than stopping one day short of it.
    const since = new Date(Date.now());
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    // Table/column names are Prisma.raw (identifiers can't be bound
    // parameters), but every value below — `since`, in the WHERE clauses —
    // is passed through Prisma.sql's normal ${} binding, never string-built,
    // and `metric` itself only ever selects one of these five fixed
    // literals, never reaches the query as free text.
    const table = Prisma.raw({ users: `"users"`, organizations: `"organizations"`, projects: `"projects"`, deployments: `"deployments"`, revenue: `"payments"` }[metric]);
    const dateColumn = Prisma.raw(`"createdAt"`);
    const valueExpr = Prisma.raw(metric === "revenue" ? `"amountCents"` : "1");
    const filter =
      metric === "users" || metric === "organizations" || metric === "projects"
        ? Prisma.sql`"deletedAt" IS NULL`
        : metric === "revenue"
          ? Prisma.sql`status = 'SUCCEEDED'`
          : Prisma.sql`TRUE`;

    const baseline = await this.prisma.$queryRaw<{ total: bigint | null }[]>(
      Prisma.sql`SELECT SUM(${valueExpr})::bigint AS total FROM ${table} WHERE ${filter} AND ${dateColumn} < ${since}`,
    );
    const daily = await this.prisma.$queryRaw<{ day: Date; total: bigint }[]>(
      Prisma.sql`
        SELECT date_trunc('day', ${dateColumn}) AS day, SUM(${valueExpr})::bigint AS total
        FROM ${table}
        WHERE ${filter} AND ${dateColumn} >= ${since}
        GROUP BY day ORDER BY day ASC
      `,
    );

    const dailyByKey = new Map(daily.map((row) => [row.day.toISOString().slice(0, 10), Number(row.total)]));
    let running = Number(baseline[0]?.total ?? 0n);
    const points: { date: string; value: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      running += dailyByKey.get(key) ?? 0;
      points.push({ date: key, value: running });
    }
    return { metric, days, points };
  }

  async analytics(days: number) {
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

  users(take: number, cursor?: string) {
    return this.prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, email: true, fullName: true, isPlatformAdmin: true, isSuspended: true, suspendedReason: true, twoFactorEnabled: true, lastLoginAt: true, createdAt: true, _count: { select: { organizationMembers: true } } }, orderBy: { createdAt: "desc" }, take, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  }

  organizations(take: number, cursor?: string) {
    return this.prisma.organization.findMany({ where: { deletedAt: null }, include: { subscription: { include: { plan: true } }, _count: { select: { members: true, projects: true, databases: true } } }, orderBy: { createdAt: "desc" }, take, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  }

  projects(take: number, cursor?: string) {
    return this.prisma.project.findMany({ where: { deletedAt: null }, include: { organization: { select: { id: true, name: true } }, _count: { select: { services: true, deployments: true } } }, orderBy: { createdAt: "desc" }, take, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  }

  deployments(take: number) { return this.prisma.deployment.findMany({ include: { project: { select: { id: true, name: true, organization: { select: { name: true } } } }, service: { select: { name: true } }, build: true }, orderBy: { createdAt: "desc" }, take }); }
  services(take: number) { return this.prisma.service.findMany({ where: { deletedAt: null }, include: { project: { select: { id: true, name: true, organizationId: true } } }, orderBy: { createdAt: "desc" }, take }); }
  storageBuckets(take: number) { return this.prisma.storageBucket.findMany({ include: { organization: { select: { name: true } }, _count: { select: { objects: true } } }, orderBy: { createdAt: "desc" }, take }); }
  databases(take: number) { return this.prisma.database.findMany({ where: { deletedAt: null }, select: { id: true, name: true, engine: true, status: true, region: true, cpuCores: true, ramMb: true, storageMb: true, storageUsedMb: true, createdAt: true, organization: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take }); }
  containers(take: number) { return this.prisma.container.findMany({ include: { service: { select: { id: true, name: true, project: { select: { id: true, name: true, organizationId: true } } } }, runtimeNode: { include: { server: { select: { hostname: true } } } } }, orderBy: { createdAt: "desc" }, take }); }
  domains(take: number) { return this.prisma.domain.findMany({ where: { deletedAt: null }, include: { organization: { select: { name: true } }, project: { select: { name: true } }, ssl: true }, orderBy: { createdAt: "desc" }, take }); }
  plans() { return this.prisma.plan.findMany({ include: { _count: { select: { subscriptions: true } } }, orderBy: { priceMonthlyCents: "asc" } }); }
  subscriptions(take: number) { return this.prisma.subscription.findMany({ include: { organization: { select: { name: true } }, plan: true }, orderBy: { createdAt: "desc" }, take }); }
  transactions(take: number) { return this.prisma.payment.findMany({ include: { invoice: { include: { organization: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take }); }
  usage(take: number) { return this.prisma.usageRecord.findMany({ include: { organization: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take }); }
  logs(take: number) { return this.prisma.auditLog.findMany({ include: { user: { select: { email: true } }, organization: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take }); }

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
