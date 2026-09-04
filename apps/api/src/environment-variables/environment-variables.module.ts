import { Module } from "@nestjs/common";
import { EnvironmentVariablesController } from "./environment-variables.controller";
import { EnvironmentVariablesService } from "./environment-variables.service";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  controllers: [EnvironmentVariablesController],
  providers: [EnvironmentVariablesService, RolesGuard],
  exports: [EnvironmentVariablesService],
})
export class EnvironmentVariablesModule {}
