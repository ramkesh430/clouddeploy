import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService, WEBHOOK_DELIVERY_QUEUE } from "./webhooks.service";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_DELIVERY_QUEUE }), ActivityLogModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryProcessor, RolesGuard],
  exports: [WebhooksService],
})
export class WebhooksModule {}
