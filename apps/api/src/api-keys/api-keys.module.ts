import { Module } from "@nestjs/common";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [ActivityLogModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, RolesGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
