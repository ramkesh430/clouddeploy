import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CronJobsController } from "./cron-jobs.controller";
import { CronJobsService, CRON_QUEUE } from "./cron-jobs.service";
import { CronProcessor } from "./cron.processor";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  imports: [BullModule.registerQueue({ name: CRON_QUEUE })],
  controllers: [CronJobsController],
  providers: [CronJobsService, CronProcessor, RolesGuard],
  exports: [CronJobsService],
})
export class CronJobsModule {}
