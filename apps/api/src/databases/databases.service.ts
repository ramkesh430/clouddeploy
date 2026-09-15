import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import crypto from "node:crypto";
import { encryptSecret, decryptSecretWithFallback } from "@clouddeploy/security";
import { RESOURCE_PRESETS } from "@clouddeploy/types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDatabaseDto } from "./dto/create-database.dto";
import { PostgresAdminService } from "./postgres-admin.service";
import { MysqlAdminService } from "./mysql-admin.service";
import { MongoAdminService } from "./mongo-admin.service";
import { PostgresBackupService } from "./postgres-backup.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { NotificationsService } from "../notifications/notifications.service";
import { UsageService } from "../usage/usage.service";
import { ActivityLogService } from "../activity-log/activity-log.service";

const DEFAULT_PORTS: Record<string, number> = { POSTGRESQL: 5432, MYSQL: 3306, MARIADB: 3306, MONGODB: 27017 };
const DEFAULT_VERSIONS: Record<string, string> = { POSTGRESQL: "16", MYSQL: "8.4", MARIADB: "11", MONGODB: "7" };

export const DATABASE_BACKUPS_QUEUE = "database-backups";

/** daily -> every day at 3am; weekly -> every Sunday at 3am. */
const BACKUP_CRON_PATTERNS: Record<string, string> = {
  daily: "0 3 * * *",
  weekly: "0 3 * * 0",
};

@Injectable()
export class DatabasesService {
  private readonly logger = new Logger("DatabasesService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly postgresAdmin: PostgresAdminService,
    private readonly mysqlAdmin: MysqlAdminService,
    private readonly mongoAdmin: MongoAdminService,
    private readonly postgresBackup: PostgresBackupService,
    private readonly webhooks: WebhooksService,
    private readonly notifications: NotificationsService,
    private readonly usage: UsageService,
    private readonly activityLog: ActivityLogService,
    @InjectQueue(DATABASE_BACKUPS_QUEUE) private readonly backupQueue: Queue,
  ) {}

  async scheduleAutomaticBackups(databaseId: string, frequency: string) {
    const pattern = BACKUP_CRON_PATTERNS[frequency];
    if (!pattern) return; // "manual" or unrecognized — no schedule
    await this.backupQueue.upsertJobScheduler(
      databaseId,
      { pattern, tz: "UTC" },
      { name: "run-automatic-backup", data: { databaseId }, opts: { removeOnComplete: 50, removeOnFail: 50 } },
    );
  }

  async unscheduleAutomaticBackups(databaseId: string) {
    await this.backupQueue.removeJobScheduler(databaseId).catch(() => undefined);
  }

  /** Deletes completed backups older than the database's retention window
   * (both the DB row and, best-effort, the underlying S3 object). */
  async pruneExpiredBackups(databaseId: string) {
    const database = await this.prisma.database.findUnique({ where: { id: databaseId } });
    if (!database) return;

    const cutoff = new Date(Date.now() - database.backupRetentionDays * 24 * 60 * 60 * 1000);
    const expired = await this.prisma.databaseBackup.findMany({
      where: { databaseId, status: "COMPLETED", createdAt: { lt: cutoff } },
    });
    if (expired.length === 0) return;

    for (const backup of expired) {
      if (backup.s3Key) {
        await this.postgresBackup.deleteBackupObject(backup.s3Key).catch(() => undefined);
      }
    }
    await this.prisma.databaseBackup.deleteMany({ where: { id: { in: expired.map((b) => b.id) } } });
    this.logger.log(`Pruned ${expired.length} expired backup(s) for database ${databaseId}`);
  }

  async list(organizationId: string) {
    const rows = await this.prisma.database.findMany({
      where: { organizationId, deletedAt: null },
      include: { _count: { select: { backups: true, connections: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.withoutSecrets(r));
  }

  async create(dto: CreateDatabaseDto) {
    const dbLimit = await this.usage.checkLimit(dto.organizationId, "databases");
    if (!dbLimit.allowed) {
      throw new BadRequestException(
        `Your plan is limited to ${dbLimit.limit} database${dbLimit.limit === 1 ? "" : "s"}. Upgrade to create more.`,
      );
    }

    const preset = RESOURCE_PRESETS.find((p) => p.id === (dto.resourcePreset ?? "starter"))!;
    const username = `${dto.name.replace(/-/g, "_")}_user`;
    const databaseName = dto.name.replace(/-/g, "_");
    const password = crypto.randomBytes(18).toString("base64url");
    const region = dto.region ?? "us-east";
    const platformDomain = this.config.get<string>("PLATFORM_DOMAIN") ?? "clouddeploy.app";

    const database = await this.prisma.database.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        engine: dto.engine,
        version: dto.version ?? DEFAULT_VERSIONS[dto.engine]!,
        status: "PROVISIONING",
        region,
        host: `${dto.name}.${platformDomain}`,
        privateHost: `${dto.name}.internal`,
        port: DEFAULT_PORTS[dto.engine]!,
        databaseName,
        username,
        passwordCipher: encryptSecret(password, this.config.getOrThrow("ENCRYPTION_KEY")),
        cpuCores: preset.cpuCores,
        ramMb: preset.ramMb,
        storageMb: preset.diskMb,
        backupFrequency: dto.backupFrequency ?? "daily",
      },
    });

    // Real provisioning either way: a logically-isolated database + user on
    // the shared server for the chosen engine (see PostgresAdminService and
    // MysqlAdminService for why one-server-many-databases is the right MVP
    // fidelity level). MariaDB shares MySQL's admin path — mysql2 speaks
    // MariaDB's wire protocol too.
    const provision = dto.engine === "POSTGRESQL"
      ? this.postgresAdmin.createTenantDatabase(databaseName, username, password)
      : dto.engine === "MONGODB"
        ? this.mongoAdmin.createTenantDatabase(databaseName, username, password)
        : this.mysqlAdmin.createTenantDatabase(databaseName, username, password);
    provision
      .then(async () => {
        await this.prisma.database.update({ where: { id: database.id }, data: { status: "RUNNING" } });
        await this.scheduleAutomaticBackups(database.id, database.backupFrequency);
      })
      .catch(async (err) => {
        this.logger.error(`Failed to provision ${dto.engine} database "${databaseName}": ${err.message}`);
        await this.prisma.database.update({ where: { id: database.id }, data: { status: "FAILED" } });
      });

    await this.usage.record(dto.organizationId, "database_created", 1, "count");

    return { ...this.withoutSecrets(database), initialPassword: password };
  }

  async findOne(databaseId: string) {
    const database = await this.prisma.database.findFirst({
      where: { id: databaseId, deletedAt: null },
      include: { backups: { orderBy: { createdAt: "desc" }, take: 20 }, users: true, connections: true },
    });
    if (!database) throw new NotFoundException("Database not found");
    return this.withoutSecrets(database);
  }

  async getConnectionInfo(databaseId: string) {
    const database = await this.assertExists(databaseId);
    return {
      engine: database.engine,
      version: database.version,
      host: database.host,
      privateHost: database.privateHost,
      port: database.port,
      database: database.databaseName,
      username: database.username,
      password: decryptSecretWithFallback(database.passwordCipher, this.config.getOrThrow("ENCRYPTION_KEY"), this.config.get("ENCRYPTION_KEY_PREVIOUS")),
      connectionUrl: this.buildConnectionUrl(database),
    };
  }

  async rotatePassword(databaseId: string) {
    const database = await this.assertExists(databaseId);
    const newPassword = crypto.randomBytes(18).toString("base64url");

    if (database.status === "RUNNING") {
      if (database.engine === "POSTGRESQL") await this.postgresAdmin.rotateTenantPassword(database.username, newPassword);
      else if (database.engine === "MONGODB") await this.mongoAdmin.rotateTenantPassword(database.username, newPassword);
      else await this.mysqlAdmin.rotateTenantPassword(database.username, newPassword);
    }

    await this.prisma.database.update({
      where: { id: databaseId },
      data: { passwordCipher: encryptSecret(newPassword, this.config.getOrThrow("ENCRYPTION_KEY")) },
    });
    return { rotated: true, newPassword };
  }

  async restart(databaseId: string) {
    await this.assertExists(databaseId);
    await this.prisma.database.update({ where: { id: databaseId }, data: { status: "RESTARTING" } });
    setTimeout(() => {
      this.prisma.database.update({ where: { id: databaseId }, data: { status: "RUNNING" } }).catch(() => undefined);
    }, 2000);
    return { restarting: true };
  }

  async createBackup(databaseId: string, type: "AUTOMATIC" | "MANUAL" = "MANUAL") {
    const database = await this.assertExists(databaseId);
    const backup = await this.prisma.databaseBackup.create({
      data: { databaseId, type, status: "RUNNING", startedAt: new Date(), retentionDays: database.backupRetentionDays },
    });

    const s3Key = `backups/${databaseId}/${backup.id}.sql.gz`;

    const finishOk = async (sizeBytes: number) => {
      await this.prisma.databaseBackup.update({
        where: { id: backup.id },
        data: { status: "COMPLETED", finishedAt: new Date(), sizeBytes: BigInt(sizeBytes), s3Key },
      });
      await this.onBackupCompleted(database, backup.id);
    };
    const finishErr = async (err: Error) => {
      this.logger.error(`Backup failed for database ${databaseId}: ${err.message}`);
      await this.prisma.databaseBackup.update({
        where: { id: backup.id },
        data: { status: "FAILED", finishedAt: new Date() },
      });
      await this.onBackupFailed(database, backup.id, err.message);
    };

    if (database.engine === "POSTGRESQL") {
      this.postgresBackup.createBackup(database.databaseName, s3Key).then(({ sizeBytes }) => finishOk(sizeBytes)).catch(finishErr);
    } else if (database.engine === "MONGODB") {
      this.mongoAdmin
        .dumpDatabase(database.databaseName)
        .then(async (archive) => {
          const zlib = await import("node:zlib");
          const compressed = zlib.gzipSync(archive);
          const { S3Adapter } = await import("@clouddeploy/storage");
          const s3 = new S3Adapter({
            endpoint: this.config.getOrThrow("S3_ENDPOINT"),
            region: this.config.get("S3_REGION") ?? "us-east-1",
            accessKeyId: this.config.getOrThrow("S3_ACCESS_KEY"),
            secretAccessKey: this.config.getOrThrow("S3_SECRET_KEY"),
          });
          const bucket = this.config.get<string>("S3_BACKUPS_BUCKET") ?? "clouddeploy-backups";
          await s3.ensureBucket(bucket);
          await s3.putObject(bucket, s3Key, compressed, "application/gzip");
          await finishOk(compressed.length);
        })
        .catch(finishErr);
    } else {
      const { execInContainer } = await import("@clouddeploy/docker");
      execInContainer(this.config.get<string>("MYSQL_CONTAINER_NAME") ?? "clouddeploy-mysql-1", [
        "mysqldump",
        "-uroot",
        "-pclouddeploy",
        "--single-transaction",
        "--routines",
        database.databaseName,
      ])
        .then(async (result) => {
          if (result.exitCode !== 0) throw new Error(result.stderr.slice(0, 2000));
          const zlib = await import("node:zlib");
          const compressed = zlib.gzipSync(result.stdout);
          const { S3Adapter } = await import("@clouddeploy/storage");
          const s3 = new S3Adapter({
            endpoint: this.config.getOrThrow("S3_ENDPOINT"),
            region: this.config.get("S3_REGION") ?? "us-east-1",
            accessKeyId: this.config.getOrThrow("S3_ACCESS_KEY"),
            secretAccessKey: this.config.getOrThrow("S3_SECRET_KEY"),
          });
          const bucket = this.config.get<string>("S3_BACKUPS_BUCKET") ?? "clouddeploy-backups";
          await s3.ensureBucket(bucket);
          await s3.putObject(bucket, s3Key, compressed, "application/gzip");
          await finishOk(compressed.length);
        })
        .catch(finishErr);
    }

    return backup;
  }

  private async onBackupCompleted(database: { id: string; organizationId: string; name: string }, backupId: string) {
    await this.webhooks.dispatch(database.organizationId, "database.backup.completed", { databaseId: database.id, backupId, databaseName: database.name });
    await this.notifications.notifyOrganization(
      database.organizationId,
      "DATABASE_BACKUP_COMPLETED",
      `Backup completed for ${database.name}`,
      `A backup of ${database.name} finished successfully.`,
    );
  }

  private async onBackupFailed(database: { id: string; organizationId: string; name: string }, backupId: string, error: string) {
    await this.webhooks.dispatch(database.organizationId, "database.backup.failed", { databaseId: database.id, backupId, databaseName: database.name, error });
    await this.notifications.notifyOrganization(
      database.organizationId,
      "DATABASE_BACKUP_FAILED",
      `Backup failed for ${database.name}`,
      `A backup of ${database.name} failed: ${error}`,
    );
  }

  async listBackups(databaseId: string) {
    return this.prisma.databaseBackup.findMany({ where: { databaseId }, orderBy: { createdAt: "desc" } });
  }

  async restoreBackup(databaseId: string, backupId: string, userId?: string) {
    const database = await this.assertExists(databaseId);
    const backup = await this.prisma.databaseBackup.findFirst({ where: { id: backupId, databaseId } });
    if (!backup || backup.status !== "COMPLETED" || !backup.s3Key) {
      throw new NotFoundException("Backup not found or not yet completed");
    }
    await this.prisma.database.update({ where: { id: databaseId }, data: { status: "RESTARTING" } });

    await this.activityLog.log({
      organizationId: database.organizationId,
      userId,
      action: "database.backup_restored",
      resourceType: "Database",
      resourceId: databaseId,
    });

    if (database.engine === "POSTGRESQL") {
      this.postgresBackup
        .restoreBackup(database.databaseName, backup.s3Key)
        .then(() => this.prisma.database.update({ where: { id: databaseId }, data: { status: "RUNNING" } }))
        .catch(async (err) => {
          this.logger.error(`Restore failed for database ${databaseId}: ${err.message}`);
          await this.prisma.database.update({ where: { id: databaseId }, data: { status: "FAILED" } });
        });
    } else if (database.engine === "MONGODB") {
      const { S3Adapter } = await import("@clouddeploy/storage");
      const zlib = await import("node:zlib");
      const s3 = new S3Adapter({
        endpoint: this.config.getOrThrow("S3_ENDPOINT"),
        region: this.config.get("S3_REGION") ?? "us-east-1",
        accessKeyId: this.config.getOrThrow("S3_ACCESS_KEY"),
        secretAccessKey: this.config.getOrThrow("S3_SECRET_KEY"),
      });
      const bucket = this.config.get<string>("S3_BACKUPS_BUCKET") ?? "clouddeploy-backups";
      s3.getObjectBuffer(bucket, backup.s3Key)
        .then(async (compressed) => {
          const archive = zlib.gunzipSync(compressed);
          await this.mongoAdmin.restoreDatabase(database.databaseName, archive);
          await this.prisma.database.update({ where: { id: databaseId }, data: { status: "RUNNING" } });
        })
        .catch(async (err) => {
          this.logger.error(`Restore failed for database ${databaseId}: ${err.message}`);
          await this.prisma.database.update({ where: { id: databaseId }, data: { status: "FAILED" } });
        });
    } else {
      setTimeout(() => {
        this.prisma.database.update({ where: { id: databaseId }, data: { status: "RUNNING" } }).catch(() => undefined);
      }, 3000);
    }

    return { restoring: true, fromBackup: backupId };
  }

  /** Soft delete — real infra (the tenant's database/role or database/user)
   * is dropped immediately since it holds no independent value once
   * detached from the platform. */
  async remove(databaseId: string) {
    const database = await this.assertExists(databaseId);
    const drop = database.engine === "POSTGRESQL"
      ? this.postgresAdmin.dropTenantDatabase(database.databaseName, database.username)
      : database.engine === "MONGODB"
        ? this.mongoAdmin.dropTenantDatabase(database.databaseName, database.username)
        : this.mysqlAdmin.dropTenantDatabase(database.databaseName, database.username);
    await drop.catch((err) => {
      this.logger.error(`Failed to drop ${database.engine} database "${database.databaseName}": ${err.message}`);
    });
    await this.unscheduleAutomaticBackups(databaseId);
    await this.prisma.database.update({ where: { id: databaseId }, data: { deletedAt: new Date() } });
    return { removed: true };
  }

  private buildConnectionUrl(database: { engine: string; username: string; passwordCipher: string; privateHost: string; port: number; databaseName: string }) {
    const password = decryptSecretWithFallback(database.passwordCipher, this.config.getOrThrow("ENCRYPTION_KEY"), this.config.get("ENCRYPTION_KEY_PREVIOUS"));
    if (database.engine === "MONGODB") {
      return `mongodb://${database.username}:${password}@${database.privateHost}:${database.port}/${database.databaseName}?authSource=admin`;
    }
    const scheme = database.engine === "POSTGRESQL" ? "postgresql" : "mysql";
    return `${scheme}://${database.username}:${password}@${database.privateHost}:${database.port}/${database.databaseName}`;
  }

  private withoutSecrets<T extends { passwordCipher?: string }>(row: T): Omit<T, "passwordCipher"> {
    const { passwordCipher, ...rest } = row;
    return rest;
  }

  private async assertExists(databaseId: string) {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    return database;
  }
}
