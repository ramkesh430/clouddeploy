import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UsageModule } from "../usage/usage.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [UsageModule, ActivityLogModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, RolesGuard],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
