import { Module } from "@nestjs/common";
import { DatabasesController } from "./databases.controller";
import { DatabasesService } from "./databases.service";
import { DatabaseManagerService } from "./database-manager.service";
import { PostgresAdminService } from "./postgres-admin.service";
import { PostgresBackupService } from "./postgres-backup.service";
import { RolesGuard } from "../auth/guards/roles.guard";

@Module({
  controllers: [DatabasesController],
  providers: [DatabasesService, DatabaseManagerService, PostgresAdminService, PostgresBackupService, RolesGuard],
  exports: [DatabasesService],
})
export class DatabasesModule {}
