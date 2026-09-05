import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { AutoscalingController } from "./autoscaling.controller";
import { AutoscalingProcessor } from "./autoscaling.processor";
import { AUTOSCALING_QUEUE, AutoscalingService } from "./autoscaling.service";

@Module({
  imports: [BullModule.registerQueue({ name: AUTOSCALING_QUEUE }), InfrastructureModule],
  controllers: [AutoscalingController],
  providers: [AutoscalingService, AutoscalingProcessor],
  exports: [AutoscalingService],
})
export class AutoscalingModule {}
