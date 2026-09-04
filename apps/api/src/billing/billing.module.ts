import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { PlansController } from "./plans.controller";
import { BillingService } from "./billing.service";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  controllers: [BillingController, PlansController],
  providers: [BillingService, RolesGuard],
  exports: [BillingService],
})
export class BillingModule {}
