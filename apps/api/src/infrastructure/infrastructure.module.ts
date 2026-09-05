import { Module } from "@nestjs/common";
import { AdminInfrastructureController, RegionsController, ServerAgentController } from "./infrastructure.controller";
import { InfrastructureService } from "./infrastructure.service";
import { RoutingService } from "./routing.service";
import { SchedulerService } from "./scheduler.service";

@Module({
  controllers: [RegionsController, ServerAgentController, AdminInfrastructureController],
  providers: [InfrastructureService, RoutingService, SchedulerService],
  exports: [InfrastructureService, RoutingService, SchedulerService],
})
export class InfrastructureModule {}
