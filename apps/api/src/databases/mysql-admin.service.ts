import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import mysql, { type Pool } from "mysql2/promise";

const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

function assertSafeIdentifier(value: string, label: string): void {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Unsafe ${label} identifier: ${value}`);
  }
}

/**
 * Provisions real, logically-isolated MySQL/MariaDB databases on the shared
 * MySQL server (infra/docker/docker-compose.yml's `mysql` service) — the
 * same one-server-many-databases MVP fidelity level PostgresAdminService
 * uses for Postgres. mysql2 speaks MariaDB's wire protocol too, so this one
 * service backs both DatabaseEngine values; MariaDB gets its own Docker
 * image at deploy time, not a separate admin path here.
 *
 * MySQL users are host-scoped ('user'@'host'), unlike Postgres's
 * cluster-wide roles — every user here is created as 'name'@'%' (any host),
 * since tenant connections come from the API process, not a fixed address.
 */
@Injectable()
export class MysqlAdminService {
  private readonly logger = new Logger("MysqlAdminService");
  private adminPool: Pool | null = null;

  constructor(private readonly config: ConfigService) {}

  private getAdminPool(): Pool {
    if (!this.adminPool) {
      const url = new URL(this.config.getOrThrow<string>("MYSQL_URL"));
      this.adminPool = mysql.createPool({
        host: url.hostname,
        port: Number(url.port || 3306),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        connectionLimit: 5,
      });
    }
    return this.adminPool;
  }

  async createTenantDatabase(databaseName: string, username: string, password: string): Promise<void> {
    assertSafeIdentifier(databaseName, "database name");
    assertSafeIdentifier(username, "user name");
    const pool = this.getAdminPool();

    await pool.query(`CREATE DATABASE \`${databaseName}\``);
    // Password can't be bound as a query parameter inside CREATE USER's DDL
    // grammar; it's always our own crypto.randomBytes() output, never
    // attacker-controlled, and single quotes are doubled per standard SQL
    // string-literal escaping.
    await pool.query(`CREATE USER '${username}'@'%' IDENTIFIED BY '${this.escapeLiteral(password)}'`);
    await pool.query(`GRANT ALL PRIVILEGES ON \`${databaseName}\`.* TO '${username}'@'%'`);
    await pool.query(`FLUSH PRIVILEGES`);
    this.logger.log(`Provisioned tenant database "${databaseName}" owned by user "${username}"`);
  }

  async dropTenantDatabase(databaseName: string, username: string): Promise<void> {
    assertSafeIdentifier(databaseName, "database name");
    assertSafeIdentifier(username, "user name");
    const pool = this.getAdminPool();

    await this.killConnections(databaseName);
    await pool.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await pool.query(`DROP USER IF EXISTS '${username}'@'%'`);
    await pool.query(`FLUSH PRIVILEGES`);
  }

  async rotateTenantPassword(username: string, newPassword: string): Promise<void> {
    assertSafeIdentifier(username, "user name");
    const pool = this.getAdminPool();
    await pool.query(`ALTER USER '${username}'@'%' IDENTIFIED BY '${this.escapeLiteral(newPassword)}'`);
    await pool.query(`FLUSH PRIVILEGES`);
  }

  /** Creates an additional MySQL user scoped to one tenant database — the
   * MySQL equivalent of PostgresAdminService.createScopedRole(), used for
   * "Database Users" (e.g. a read-only credential for an analytics tool).
   * MySQL privileges are granted per (user, database) pair directly against
   * the admin connection — no separate per-database connection needed the
   * way Postgres's default-privileges mechanism requires. */
  async createScopedUser(databaseName: string, username: string, password: string, access: "readonly" | "readwrite"): Promise<void> {
    assertSafeIdentifier(databaseName, "database name");
    assertSafeIdentifier(username, "user name");
    const pool = this.getAdminPool();
    await pool.query(`CREATE USER '${username}'@'%' IDENTIFIED BY '${this.escapeLiteral(password)}'`);
    const privileges = access === "readwrite" ? "SELECT, INSERT, UPDATE, DELETE" : "SELECT";
    await pool.query(`GRANT ${privileges} ON \`${databaseName}\`.* TO '${username}'@'%'`);
    await pool.query(`FLUSH PRIVILEGES`);
    this.logger.log(`Created scoped user "${username}" (${access}) on database "${databaseName}"`);
  }

  async dropScopedUser(username: string): Promise<void> {
    assertSafeIdentifier(username, "user name");
    const pool = this.getAdminPool();
    await this.killConnections(undefined, username);
    await pool.query(`DROP USER IF EXISTS '${username}'@'%'`);
    await pool.query(`FLUSH PRIVILEGES`);
  }

  private async killConnections(databaseName?: string, username?: string): Promise<void> {
    const pool = this.getAdminPool();
    const conditions: string[] = [];
    const params: string[] = [];
    if (databaseName) { conditions.push("db = ?"); params.push(databaseName); }
    if (username) { conditions.push("user = ?"); params.push(username); }
    if (conditions.length === 0) return;
    const [rows] = await pool.query<mysql.RowDataPacket[]>(`SELECT id FROM information_schema.processlist WHERE ${conditions.join(" AND ")}`, params);
    for (const row of rows) {
      await pool.query(`KILL ${Number(row.id)}`).catch(() => undefined);
    }
  }

  private escapeLiteral(value: string): string {
    return value.replace(/'/g, "''");
  }

  /** Opens a short-lived pool authenticated AS the tenant's own user,
   * scoped to their own database. */
  createTenantPool(databaseName: string, username: string, password: string): Pool {
    assertSafeIdentifier(databaseName, "database name");
    assertSafeIdentifier(username, "user name");
    const url = new URL(this.config.getOrThrow<string>("MYSQL_URL"));
    return mysql.createPool({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: username,
      password,
      database: databaseName,
      connectionLimit: 3,
      connectTimeout: 15_000,
    });
  }
}
