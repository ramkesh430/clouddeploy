import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import crypto from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WEBHOOK_DELIVERY_QUEUE } from "./webhooks.service";

interface DeliveryJobData {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
}

/**
 * Delivers one webhook event. Retries (3 attempts, exponential backoff) are
 * handled by BullMQ itself via the job options set at enqueue time — this
 * processor just needs to throw on failure for BullMQ to reschedule it, and
 * records one WebhookDelivery row per attempt either way.
 */
@Processor(WEBHOOK_DELIVERY_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger("WebhookDeliveryProcessor");

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<DeliveryJobData>): Promise<void> {
    const { webhookId, event, payload } = job.data;
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook || !webhook.isActive) return;

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = crypto.createHmac("sha256", webhook.secret).update(body).digest("hex");

    let responseStatus: number | null = null;
    let succeeded = false;
    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CloudDeploy-Event": event,
          "X-CloudDeploy-Signature": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      responseStatus = res.status;
      succeeded = res.ok;
    } catch (err) {
      this.logger.warn(`Webhook delivery to ${webhook.url} failed: ${(err as Error).message}`);
    }

    await this.prisma.webhookDelivery.create({
      data: { webhookId, event, payload: payload as object, responseStatus, succeeded, attempt: job.attemptsMade + 1 },
    });

    if (!succeeded) {
      throw new Error(`Webhook delivery failed${responseStatus ? ` with status ${responseStatus}` : ""}`);
    }
  }
}
