import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DeploymentsController } from "./deployments.controller";
import { DeploymentsService, DEPLOYMENTS_QUEUE } from "./deployments.service";
import { DeploymentProcessor } from "./deployment.processor";
import { DeploymentsGateway } from "./deployments.gateway";
import { GitCloneService } from "./git-clone.service";
import { ImageBuildService } from "./image-build.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { DomainsModule } from "../domains/domains.module";

@Module({
  imports: [BullModule.registerQueue({ name: DEPLOYMENTS_QUEUE }), WebhooksModule, NotificationsModule, InfrastructureModule, DomainsModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentProcessor, DeploymentsGateway, RolesGuard, GitCloneService, ImageBuildService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
