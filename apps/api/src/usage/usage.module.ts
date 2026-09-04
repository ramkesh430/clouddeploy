import { Module } from "@nestjs/common";
import { UsageController } from "./usage.controller";
import { UsageService } from "./usage.service";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  controllers: [UsageController],
  providers: [UsageService, RolesGuard],
  exports: [UsageService],
})
export class UsageModule {}
