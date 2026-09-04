import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";
import { AlertCheckProcessor, ALERT_CHECK_QUEUE } from "./alert-check.processor";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DatabasesModule } from "../databases/databases.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WebhooksModule } from "../webhooks/webhooks.module";

@Module({
  imports: [BullModule.registerQueue({ name: ALERT_CHECK_QUEUE }), DatabasesModule, NotificationsModule, WebhooksModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertCheckProcessor, RolesGuard],
  exports: [AlertsService],
})
export class AlertsModule {}
