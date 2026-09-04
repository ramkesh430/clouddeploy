import { Module } from "@nestjs/common";
import { DatabasesController } from "./databases.controller";
import { DatabasesService } from "./databases.service";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  controllers: [DatabasesController],
  providers: [DatabasesService, RolesGuard],
  exports: [DatabasesService],
})
export class DatabasesModule {}
