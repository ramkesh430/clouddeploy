import { Module } from "@nestjs/common";
import { ActivityLogService } from "./activity-log.service";
import { ActivityLogController } from "./activity-log.controller";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  controllers: [ActivityLogController],
  providers: [ActivityLogService, RolesGuard],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
