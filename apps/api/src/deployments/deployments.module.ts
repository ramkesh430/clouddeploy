import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DeploymentsController } from "./deployments.controller";
import { DeploymentsService, DEPLOYMENTS_QUEUE } from "./deployments.service";
import { DeploymentProcessor } from "./deployment.processor";
import { DeploymentsGateway } from "./deployments.gateway";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  imports: [BullModule.registerQueue({ name: DEPLOYMENTS_QUEUE })],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentProcessor, DeploymentsGateway, RolesGuard],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
