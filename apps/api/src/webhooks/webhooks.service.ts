import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import crypto from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { CreateWebhookDto } from "./dto/create-webhook.dto";

export const WEBHOOK_DELIVERY_QUEUE = "webhook-deliveries";

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE) private readonly queue: Queue,
  ) {}

  async list(organizationId: string) {
    return this.prisma.webhook.findMany({
      where: { organizationId },
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: CreateWebhookDto, userId?: string) {
    const secret = crypto.randomBytes(24).toString("hex");
    const webhook = await this.prisma.webhook.create({
      data: {
        organizationId: dto.organizationId,
        projectId: dto.projectId,
        url: dto.url,
        secret,
        events: dto.events,
      },
    });

    await this.activityLog.log({
      organizationId: dto.organizationId,
      projectId: dto.projectId,
      userId,
      action: "webhook.created",
      resourceType: "Webhook",
      resourceId: webhook.id,
    });
    return webhook;
  }

  async remove(webhookId: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new NotFoundException("Webhook not found");
    await this.prisma.webhook.delete({ where: { id: webhookId } });
    return { removed: true };
  }

  async listDeliveries(webhookId: string) {
    return this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  /** Fires `event` to every active webhook subscribed to it, scoped to the
   * organization and (if the webhook is project-scoped) matching project. */
  async dispatch(organizationId: string, event: string, payload: Record<string, unknown>, projectId?: string) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        organizationId,
        isActive: true,
        events: { has: event },
        // Org-wide subscriptions (projectId: null) always match; a
        // project-scoped subscription only matches that exact project —
        // and never matches at all when this event has no project context.
        OR: projectId ? [{ projectId: null }, { projectId }] : [{ projectId: null }],
      },
    });

    for (const webhook of webhooks) {
      await this.queue.add(
        "deliver",
        { webhookId: webhook.id, event, payload },
        { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 200, removeOnFail: 200 },
      );
    }
    return { queued: webhooks.length };
  }
}
