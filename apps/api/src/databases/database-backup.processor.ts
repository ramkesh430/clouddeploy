import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { DatabasesService, DATABASE_BACKUPS_QUEUE } from "./databases.service";

/** Fires on the schedule set by DatabasesService.scheduleAutomaticBackups
 * (a real BullMQ Job Scheduler, not a timer) — runs an AUTOMATIC backup and
 * then prunes anything older than the database's retention window. */
@Processor(DATABASE_BACKUPS_QUEUE)
export class DatabaseBackupProcessor extends WorkerHost {
  private readonly logger = new Logger("DatabaseBackupProcessor");

  constructor(private readonly databasesService: DatabasesService) {
    super();
  }

  async process(job: Job<{ databaseId: string }>): Promise<void> {
    const { databaseId } = job.data;
    this.logger.log(`Running automatic backup for database ${databaseId}`);
    await this.databasesService.createBackup(databaseId, "AUTOMATIC");
    await this.databasesService.pruneExpiredBackups(databaseId);
  }
}
