import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { execInContainer } from "@clouddeploy/docker";
import { S3Adapter } from "@clouddeploy/storage";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Real backups for PostgreSQL databases: shells out to `pg_dump`/`psql`
 * inside the running Postgres container (see packages/docker for why —
 * pg_dump isn't installed on the API host, but it ships in the official
 * postgres image) and stores the compressed dump in the S3-compatible
 * backups bucket via the shared storage adapter.
 */
@Injectable()
export class PostgresBackupService {
  private readonly logger = new Logger("PostgresBackupService");
  private s3: S3Adapter | null = null;

  constructor(private readonly config: ConfigService) {}

  private getS3(): S3Adapter {
    if (!this.s3) {
      this.s3 = new S3Adapter({
        endpoint: this.config.getOrThrow("S3_ENDPOINT"),
        region: this.config.get("S3_REGION") ?? "us-east-1",
        accessKeyId: this.config.getOrThrow("S3_ACCESS_KEY"),
        secretAccessKey: this.config.getOrThrow("S3_SECRET_KEY"),
      });
    }
    return this.s3;
  }

  async createBackup(databaseName: string, s3Key: string): Promise<{ sizeBytes: number }> {
    const container = this.config.get<string>("POSTGRES_CONTAINER_NAME") ?? "clouddeploy-postgres-1";
    const bucket = this.config.get<string>("S3_BACKUPS_BUCKET") ?? "clouddeploy-backups";

    // Deliberately NOT --no-owner: the dump must preserve `ALTER TABLE ...
    // OWNER TO <tenant_role>` statements, otherwise restoring (which runs as
    // the admin superuser via docker exec) leaves every object owned by the
    // admin instead of the tenant, and the tenant's own ACL pool loses
    // access to the tables it created.
    const result = await execInContainer(container, [
      "pg_dump",
      "-U",
      "clouddeploy",
      "-d",
      databaseName,
      "--clean",
      "--if-exists",
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`pg_dump failed (exit ${result.exitCode}): ${result.stderr.slice(0, 2000)}`);
    }

    const compressed = await gzip(result.stdout);
    const s3 = this.getS3();
    await s3.ensureBucket(bucket);
    await s3.putObject(bucket, s3Key, compressed, "application/gzip");
    this.logger.log(`Backed up database "${databaseName}" -> s3://${bucket}/${s3Key} (${compressed.length} bytes)`);
    return { sizeBytes: compressed.length };
  }

  async restoreBackup(databaseName: string, s3Key: string): Promise<void> {
    const container = this.config.get<string>("POSTGRES_CONTAINER_NAME") ?? "clouddeploy-postgres-1";
    const bucket = this.config.get<string>("S3_BACKUPS_BUCKET") ?? "clouddeploy-backups";

    const s3 = this.getS3();
    const compressed = await s3.getObjectBuffer(bucket, s3Key);
    const sql = await gunzip(compressed);

    const result = await execInContainer(
      container,
      ["psql", "-U", "clouddeploy", "-d", databaseName, "-v", "ON_ERROR_STOP=1"],
      { stdin: sql },
    );

    if (result.exitCode !== 0) {
      throw new Error(`psql restore failed (exit ${result.exitCode}): ${result.stderr.slice(0, 2000)}`);
    }
    this.logger.log(`Restored database "${databaseName}" from s3://${bucket}/${s3Key}`);
  }

  async deleteBackupObject(s3Key: string): Promise<void> {
    const bucket = this.config.get<string>("S3_BACKUPS_BUCKET") ?? "clouddeploy-backups";
    await this.getS3().deleteObject(bucket, s3Key);
  }
}
