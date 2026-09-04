import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsageModule } from "../usage/usage.module";

@Module({
  imports: [UsageModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, RolesGuard, AnyAuthGuard, JwtAuthGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
