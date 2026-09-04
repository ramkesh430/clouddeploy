import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DatabaseManagerService } from "../databases/database-manager.service";
import { NotificationsService } from "../notifications/notifications.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { CreateAlertRuleDto } from "./dto/create-alert-rule.dto";

@Injectable()
export class AlertsService {
  private readonly logger = new Logger("AlertsService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly databaseManager: DatabaseManagerService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.alertRule.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  }

  async create(dto: CreateAlertRuleDto) {
    return this.prisma.alertRule.create({
      data: {
        organizationId: dto.organizationId,
        projectId: dto.projectId,
        serviceId: dto.serviceId,
        databaseId: dto.databaseId,
        metric: dto.metric,
        comparator: dto.comparator ?? "GREATER_THAN",
        threshold: dto.threshold,
        cooldownMinutes: dto.cooldownMinutes ?? 30,
      },
    });
  }

  async setEnabled(alertRuleId: string, enabled: boolean) {
    const rule = await this.prisma.alertRule.findUnique({ where: { id: alertRuleId } });
    if (!rule) throw new NotFoundException("Alert rule not found");
    return this.prisma.alertRule.update({ where: { id: alertRuleId }, data: { enabled } });
  }

  async remove(alertRuleId: string) {
    const rule = await this.prisma.alertRule.findUnique({ where: { id: alertRuleId } });
    if (!rule) throw new NotFoundException("Alert rule not found");
    await this.prisma.alertRule.delete({ where: { id: alertRuleId } });
    return { removed: true };
  }

  /** Evaluates every enabled rule against its current real (or, for
   * CPU/RAM, latest-recorded) value and fires a notification + webhook the
   * first time it breaches — then stays quiet for `cooldownMinutes` so one
   * sustained breach doesn't spam a notification every polling interval. */
  async evaluateAll(): Promise<{ evaluated: number; triggered: number }> {
    const rules = await this.prisma.alertRule.findMany({ where: { enabled: true } });
    let triggered = 0;

    for (const rule of rules) {
      if (rule.lastTriggeredAt && Date.now() - rule.lastTriggeredAt.getTime() < rule.cooldownMinutes * 60 * 1000) {
        continue;
      }
      try {
        const value = await this.readCurrentValue(rule);
        if (value === null) continue;

        const breached = rule.comparator === "GREATER_THAN" ? value > rule.threshold : value < rule.threshold;
        if (!breached) continue;

        await this.fire(rule, value);
        triggered++;
      } catch (err) {
        this.logger.warn(`Failed to evaluate alert rule ${rule.id}: ${(err as Error).message}`);
      }
    }
    return { evaluated: rules.length, triggered };
  }

  private async readCurrentValue(rule: { metric: string; serviceId: string | null; databaseId: string | null }): Promise<number | null> {
    switch (rule.metric) {
      case "CPU_PCT":
      case "RAM_PCT": {
        if (!rule.serviceId) return null;
        const latest = await this.prisma.metric.findFirst({
          where: { serviceId: rule.serviceId },
          orderBy: { timestamp: "desc" },
        });
        if (!latest) return null;
        return rule.metric === "CPU_PCT" ? latest.cpuPct : latest.ramMb;
      }
      case "DATABASE_CONNECTIONS": {
        if (!rule.databaseId) return null;
        const metrics = await this.databaseManager.getMetrics(rule.databaseId);
        return metrics.supported ? metrics.connections! : null;
      }
      case "DATABASE_STORAGE_PCT": {
        if (!rule.databaseId) return null;
        const metrics = await this.databaseManager.getMetrics(rule.databaseId);
        return metrics.supported ? metrics.storagePct! : null;
      }
      default:
        return null;
    }
  }

  private async fire(rule: { id: string; organizationId: string; projectId: string | null; metric: string; threshold: number; comparator: string }, value: number) {
    await this.prisma.alertRule.update({ where: { id: rule.id }, data: { lastTriggeredAt: new Date() } });

    const comparatorLabel = rule.comparator === "GREATER_THAN" ? "above" : "below";
    const title = `Alert: ${rule.metric.replace(/_/g, " ")} ${comparatorLabel} threshold`;
    const message = `Current value ${value} is ${comparatorLabel} the configured threshold of ${rule.threshold}.`;

    await this.notifications.notifyOrganization(rule.organizationId, this.notificationTypeFor(rule.metric), title, message);
    await this.webhooks.dispatch(
      rule.organizationId,
      "alert.triggered",
      { alertRuleId: rule.id, metric: rule.metric, value, threshold: rule.threshold },
      rule.projectId ?? undefined,
    );
  }

  private notificationTypeFor(metric: string): "CPU_HIGH" | "RAM_HIGH" | "DISK_ALMOST_FULL" {
    if (metric === "CPU_PCT") return "CPU_HIGH";
    if (metric === "RAM_PCT") return "RAM_HIGH";
    return "DISK_ALMOST_FULL";
  }
}
