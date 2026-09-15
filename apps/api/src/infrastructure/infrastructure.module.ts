import { Module } from "@nestjs/common";
import { AdminInfrastructureController, RegionsController, ServerAgentController } from "./infrastructure.controller";
import { InfrastructureService } from "./infrastructure.service";
import { RoutingService } from "./routing.service";
import { SchedulerService } from "./scheduler.service";
import { ContainerRuntimeService } from "./container-runtime.service";
import { SslIssuanceService } from "./ssl-issuance.service";

@Module({
  controllers: [RegionsController, ServerAgentController, AdminInfrastructureController],
  providers: [InfrastructureService, RoutingService, SchedulerService, ContainerRuntimeService, SslIssuanceService],
  exports: [InfrastructureService, RoutingService, SchedulerService, ContainerRuntimeService, SslIssuanceService],
})
export class InfrastructureModule {}
