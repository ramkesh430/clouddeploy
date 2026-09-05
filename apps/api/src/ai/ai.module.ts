import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { EnvironmentVariablesModule } from "../environment-variables/environment-variables.module";
import { ServicesModule } from "../services/services.module";
import { DeploymentsModule } from "../deployments/deployments.module";
import { DatabasesModule } from "../databases/databases.module";

@Module({
  imports: [EnvironmentVariablesModule, ServicesModule, DeploymentsModule, DatabasesModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
