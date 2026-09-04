import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { PlansController } from "./plans.controller";
import { BillingService } from "./billing.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [ActivityLogModule],
  controllers: [BillingController, PlansController],
  providers: [BillingService, RolesGuard],
  exports: [BillingService],
})
export class BillingModule {}
