import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

function assertSafeIdentifier(value: string, label: string): void {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Unsafe ${label} identifier: ${value}`);
  }
}

/**
 * Provisions real, logically-isolated PostgreSQL databases on the shared
 * Postgres server (one server, many databases + roles — the MVP fidelity
 * level the product spec calls for in section 6: "Each customer database
 * must be isolated logically and securely," with full container-per-tenant
 * isolation left for the Kubernetes-ready future architecture).
 *
 * Postgres enforces the isolation boundary natively: a connection
 * authenticated as a tenant's own role, to that tenant's own database,
 * cannot see or query any other tenant's database — there is no
 * cross-database SQL. The admin pool (below) is only ever used for the
 * provisioning statements themselves, never to run tenant queries.
 */
@Injectable()
export class PostgresAdminService {
  private readonly logger = new Logger("PostgresAdminService");
  private adminPool: Pool | null = null;

  constructor(private readonly config: ConfigService) {}

  private getAdminPool(): Pool {
    if (!this.adminPool) {
      const url = new URL(this.config.getOrThrow<string>("DATABASE_URL"));
      this.adminPool = new Pool({
        host: url.hostname,
        port: Number(url.port || 5432),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: "postgres",
        max: 5,
      });
    }
    return this.adminPool;
  }

  async createTenantDatabase(databaseName: string, roleName: string, password: string): Promise<void> {
    assertSafeIdentifier(databaseName, "database name");
    assertSafeIdentifier(roleName, "role name");
    const pool = this.getAdminPool();

    // CREATE ROLE's PASSWORD clause is parsed as part of the DDL grammar and
    // does not accept a bind parameter ($1) — the value must be a literal.
    // Single quotes are doubled per standard SQL string-literal escaping;
    // the password itself is always our own crypto.randomBytes() output, so
    // this isn't attacker-controlled input.
    await pool.query(`CREATE ROLE "${roleName}" WITH LOGIN PASSWORD '${this.escapeLiteral(password)}'`);
    await pool.query(`CREATE DATABASE "${databaseName}" OWNER "${roleName}"`);
    await pool.query(`REVOKE CONNECT ON DATABASE "${databaseName}" FROM PUBLIC`);
    await pool.query(`GRANT CONNECT ON DATABASE "${databaseName}" TO "${roleName}"`);
    this.logger.log(`Provisioned tenant database "${databaseName}" owned by role "${roleName}"`);
  }

  async dropTenantDatabase(databaseName: string, roleName: string): Promise<void> {
    assertSafeIdentifier(databaseName, "database name");
    assertSafeIdentifier(roleName, "role name");
    const pool = this.getAdminPool();

    await pool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await pool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await pool.query(`DROP ROLE IF EXISTS "${roleName}"`);
  }

  async rotateTenantPassword(roleName: string, newPassword: string): Promise<void> {
    assertSafeIdentifier(roleName, "role name");
    const pool = this.getAdminPool();
    await pool.query(`ALTER ROLE "${roleName}" WITH PASSWORD '${this.escapeLiteral(newPassword)}'`);
  }

  private escapeLiteral(value: string): string {
    return value.replace(/'/g, "''");
  }

  /** Opens a short-lived pool authenticated AS the tenant's own role/database. */
  createTenantPool(databaseName: string, roleName: string, password: string): Pool {
    assertSafeIdentifier(databaseName, "database name");
    assertSafeIdentifier(roleName, "role name");
    const url = new URL(this.config.getOrThrow<string>("DATABASE_URL"));
    return new Pool({
      host: url.hostname,
      port: Number(url.port || 5432),
      user: roleName,
      password,
      database: databaseName,
      max: 3,
      statement_timeout: 15_000,
    });
  }
}
