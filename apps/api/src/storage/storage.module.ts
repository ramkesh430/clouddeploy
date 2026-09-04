import { Module } from "@nestjs/common";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [ActivityLogModule],
  controllers: [StorageController],
  providers: [StorageService, RolesGuard],
  exports: [StorageService],
})
export class StorageModule {}
