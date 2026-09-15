import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DomainsModule } from "../domains/domains.module";

@Module({
  imports: [DomainsModule],
  controllers: [DashboardController],
  providers: [DashboardService, RolesGuard],
})
export class DashboardModule {}
