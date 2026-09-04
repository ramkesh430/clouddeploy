import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import crypto from "node:crypto";
import { encryptSecret, decryptSecret } from "@clouddeploy/security";
import { RESOURCE_PRESETS } from "@clouddeploy/types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDatabaseDto } from "./dto/create-database.dto";
import { PostgresAdminService } from "./postgres-admin.service";
import { PostgresBackupService } from "./postgres-backup.service";

const DEFAULT_PORTS: Record<string, number> = { POSTGRESQL: 5432, MYSQL: 3306, MARIADB: 3306 };
const DEFAULT_VERSIONS: Record<string, string> = { POSTGRESQL: "16", MYSQL: "8.4", MARIADB: "11" };

@Injectable()
export class DatabasesService {
  private readonly logger = new Logger("DatabasesService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly postgresAdmin: PostgresAdminService,
    private readonly postgresBackup: PostgresBackupService,
  ) {}

  async list(organizationId: string) {
    const rows = await this.prisma.database.findMany({
      where: { organizationId, deletedAt: null },
      include: { _count: { select: { backups: true, connections: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.withoutSecrets(r));
  }

  async create(dto: CreateDatabaseDto) {
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

    if (dto.engine === "POSTGRESQL") {
      // Real provisioning: a logically-isolated database + role on the
      // shared Postgres server (see PostgresAdminService for why this is
      // the right MVP fidelity level).
      this.postgresAdmin
        .createTenantDatabase(databaseName, username, password)
        .then(() =>
          this.prisma.database.update({ where: { id: database.id }, data: { status: "RUNNING" } }),
        )
        .catch(async (err) => {
          this.logger.error(`Failed to provision Postgres database "${databaseName}": ${err.message}`);
          await this.prisma.database.update({ where: { id: database.id }, data: { status: "FAILED" } });
        });
    } else {
      // MySQL/MariaDB provisioning requires a MySQL server in the local
      // infra stack, which isn't wired up yet — simulated until then.
      setTimeout(() => {
        this.prisma.database.update({ where: { id: database.id }, data: { status: "RUNNING" } }).catch(() => undefined);
      }, 3000);
    }

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
      password: decryptSecret(database.passwordCipher, this.config.getOrThrow("ENCRYPTION_KEY")),
      connectionUrl: this.buildConnectionUrl(database),
    };
  }

  async rotatePassword(databaseId: string) {
    const database = await this.assertExists(databaseId);
    const newPassword = crypto.randomBytes(18).toString("base64url");

    if (database.engine === "POSTGRESQL" && database.status === "RUNNING") {
      await this.postgresAdmin.rotateTenantPassword(database.username, newPassword);
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

    if (database.engine === "POSTGRESQL") {
      this.postgresBackup
        .createBackup(database.databaseName, s3Key)
        .then(({ sizeBytes }) =>
          this.prisma.databaseBackup.update({
            where: { id: backup.id },
            data: { status: "COMPLETED", finishedAt: new Date(), sizeBytes: BigInt(sizeBytes), s3Key },
          }),
        )
        .catch(async (err) => {
          this.logger.error(`Backup failed for database ${databaseId}: ${err.message}`);
          await this.prisma.databaseBackup.update({
            where: { id: backup.id },
            data: { status: "FAILED", finishedAt: new Date() },
          });
        });
    } else {
      setTimeout(() => {
        this.prisma.databaseBackup
          .update({
            where: { id: backup.id },
            data: {
              status: "COMPLETED",
              finishedAt: new Date(),
              sizeBytes: BigInt(Math.floor(Math.random() * 500_000_000)),
              s3Key: `backups/${databaseId}/${backup.id}.dump.gz.enc`,
            },
          })
          .catch(() => undefined);
      }, 2500);
    }

    return backup;
  }

  async listBackups(databaseId: string) {
    return this.prisma.databaseBackup.findMany({ where: { databaseId }, orderBy: { createdAt: "desc" } });
  }

  async restoreBackup(databaseId: string, backupId: string) {
    const database = await this.assertExists(databaseId);
    const backup = await this.prisma.databaseBackup.findFirst({ where: { id: backupId, databaseId } });
    if (!backup || backup.status !== "COMPLETED" || !backup.s3Key) {
      throw new NotFoundException("Backup not found or not yet completed");
    }
    await this.prisma.database.update({ where: { id: databaseId }, data: { status: "RESTARTING" } });

    if (database.engine === "POSTGRESQL") {
      this.postgresBackup
        .restoreBackup(database.databaseName, backup.s3Key)
        .then(() => this.prisma.database.update({ where: { id: databaseId }, data: { status: "RUNNING" } }))
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

  /** Soft delete — real infra (Postgres role/database) is dropped immediately
   * since it holds no independent value once detached from the platform. */
  async remove(databaseId: string) {
    const database = await this.assertExists(databaseId);
    if (database.engine === "POSTGRESQL") {
      await this.postgresAdmin.dropTenantDatabase(database.databaseName, database.username).catch((err) => {
        this.logger.error(`Failed to drop Postgres database "${database.databaseName}": ${err.message}`);
      });
    }
    await this.prisma.database.update({ where: { id: databaseId }, data: { deletedAt: new Date() } });
    return { removed: true };
  }

  private buildConnectionUrl(database: { engine: string; username: string; passwordCipher: string; privateHost: string; port: number; databaseName: string }) {
    const password = decryptSecret(database.passwordCipher, this.config.getOrThrow("ENCRYPTION_KEY"));
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
