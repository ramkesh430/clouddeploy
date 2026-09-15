import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DatabasesController } from "./databases.controller";
import { DatabasesService, DATABASE_BACKUPS_QUEUE } from "./databases.service";
import { DatabaseManagerService } from "./database-manager.service";
import { PostgresAdminService } from "./postgres-admin.service";
import { MysqlAdminService } from "./mysql-admin.service";
import { MongoAdminService } from "./mongo-admin.service";
import { PostgresBackupService } from "./postgres-backup.service";
import { DatabaseBackupProcessor } from "./database-backup.processor";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsageModule } from "../usage/usage.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [
    BullModule.registerQueue({ name: DATABASE_BACKUPS_QUEUE }),
    WebhooksModule,
    NotificationsModule,
    UsageModule,
    ActivityLogModule,
  ],
  controllers: [DatabasesController],
  providers: [
    DatabasesService,
    DatabaseManagerService,
    PostgresAdminService,
    MysqlAdminService,
    MongoAdminService,
    PostgresBackupService,
    DatabaseBackupProcessor,
    RolesGuard,
  ],
  exports: [DatabasesService, DatabaseManagerService],
})
export class DatabasesModule {}
