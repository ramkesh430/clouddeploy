import { Module } from "@nestjs/common";
import { ServicesController } from "./services.controller";
import { ServicesService } from "./services.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";

@Module({
  imports: [WebhooksModule, InfrastructureModule],
  controllers: [ServicesController],
  providers: [ServicesService, RolesGuard],
  exports: [ServicesService],
})
export class ServicesModule {}
