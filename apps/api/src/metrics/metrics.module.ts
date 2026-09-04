import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { MetricsRetentionService } from "./metrics-retention.service";
import { MetricsRetentionProcessor, METRICS_RETENTION_QUEUE } from "./metrics-retention.processor";
import { MetricsController } from "./metrics.controller";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  imports: [BullModule.registerQueue({ name: METRICS_RETENTION_QUEUE })],
  controllers: [MetricsController],
  providers: [MetricsRetentionService, MetricsRetentionProcessor, RolesGuard],
  exports: [MetricsRetentionService],
})
export class MetricsModule {}
