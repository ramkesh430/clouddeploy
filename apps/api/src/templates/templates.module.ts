import { Module } from "@nestjs/common";
import { TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ProjectsModule } from "../projects/projects.module";
import { ServicesModule } from "../services/services.module";
import { DatabasesModule } from "../databases/databases.module";
import { RedisDbModule } from "../redis-db/redis-db.module";
import { EnvironmentVariablesModule } from "../environment-variables/environment-variables.module";
import { DeploymentsModule } from "../deployments/deployments.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [
    ProjectsModule,
    ServicesModule,
    DatabasesModule,
    RedisDbModule,
    EnvironmentVariablesModule,
    DeploymentsModule,
    ActivityLogModule,
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService, RolesGuard],
})
export class TemplatesModule {}
