import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import crypto from "node:crypto";
import type { Pool as PgPool } from "pg";
import type { Pool as MysqlPool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { DatabaseEngine } from "@clouddeploy/database";
import { decryptSecretWithFallback, encryptSecret } from "@clouddeploy/security";
import { PrismaService } from "../prisma/prisma.service";
import { PostgresAdminService } from "./postgres-admin.service";
import { MysqlAdminService } from "./mysql-admin.service";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

function quoteIdent(value: string, label: string, engine: DatabaseEngine): string {
  if (!IDENTIFIER.test(value)) {
    throw new BadRequestException(`Invalid ${label}: ${value}`);
  }
  return engine === "POSTGRESQL" ? `"${value}"` : `\`${value}\``;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

/** Wraps whichever real driver backs this tenant's engine (pg or mysql2)
 * behind one shape, so the table browser / SQL editor logic above doesn't
 * need to know which one it's talking to for the genuinely portable parts
 * (running a statement, reading back columns/rows). Identifier quoting,
 * schema semantics, and system-catalog queries still branch on engine
 * explicitly where the two databases are actually different, rather than
 * pretending a common abstraction covers that too. */
interface TenantConnection {
  engine: DatabaseEngine;
  query(sql: string, params?: unknown[]): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number }>;
  end(): Promise<void>;
}

class PgTenantConnection implements TenantConnection {
  engine = "POSTGRESQL" as const;
  constructor(private readonly pool: PgPool) {}
  async query(sql: string, params: unknown[] = []) {
    const res = await this.pool.query(sql, params);
    return { columns: (res.fields ?? []).map((f) => f.name), rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
  }
  async end() {
    await this.pool.end();
  }
}

class MysqlTenantConnection implements TenantConnection {
  constructor(
    public readonly engine: "MYSQL" | "MARIADB",
    private readonly pool: MysqlPool,
  ) {}
  async query(sql: string, params: unknown[] = []) {
    const [result, fields] = await this.pool.query(sql, params);
    if (Array.isArray(result)) {
      return { columns: (fields ?? []).map((f) => f.name), rows: result as RowDataPacket[] as Record<string, unknown>[], rowCount: result.length };
    }
    const header = result as ResultSetHeader;
    return { columns: [], rows: [], rowCount: header.affectedRows ?? 0 };
  }
  async end() {
    await this.pool.end();
  }
}

/**
 * Table browser + SQL editor backend for all three supported engines.
 * Every query runs through a pool authenticated as the tenant's own
 * database role/user against their own database — the engine's native
 * per-database isolation is what actually keeps tenants apart, not
 * application-level filtering, for Postgres, MySQL, and MariaDB alike.
 */
@Injectable()
export class DatabaseManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly postgresAdmin: PostgresAdminService,
    private readonly mysqlAdmin: MysqlAdminService,
  ) {}

  private async getTenantConnection(databaseId: string): Promise<{ engine: DatabaseEngine; databaseName: string; conn: TenantConnection }> {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    const password = decryptSecretWithFallback(database.passwordCipher, this.config.getOrThrow("ENCRYPTION_KEY"), this.config.get("ENCRYPTION_KEY_PREVIOUS"));

    if (database.engine === "POSTGRESQL") {
      const pool = this.postgresAdmin.createTenantPool(database.databaseName, database.username, password);
      return { engine: database.engine, databaseName: database.databaseName, conn: new PgTenantConnection(pool) };
    }
    const pool = this.mysqlAdmin.createTenantPool(database.databaseName, database.username, password);
    return { engine: database.engine, databaseName: database.databaseName, conn: new MysqlTenantConnection(database.engine, pool) };
  }

  /** Postgres has real per-database schemas (namespaces); MySQL/MariaDB
   * don't — "database" and "schema" are the same thing there, and a
   * tenant's connection is already scoped to just their own. So for those
   * two engines the only real "schema" is the tenant's own database name,
   * returned directly with no query — listing every schema on the shared
   * server the way a raw SHOW DATABASES would is a different tenant's data
   * this connection has no business enumerating anyway. */
  async listSchemas(databaseId: string): Promise<string[]> {
    const { engine, databaseName, conn } = await this.getTenantConnection(databaseId);
    if (engine !== "POSTGRESQL") {
      await conn.end();
      return [databaseName];
    }
    try {
      const res = await conn.query(
        `SELECT schema_name FROM information_schema.schemata
         WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
         ORDER BY schema_name`,
      );
      return res.rows.map((r) => r.schema_name as string);
    } finally {
      await conn.end();
    }
  }

  async listTables(databaseId: string, schema?: string) {
    const { engine, databaseName, conn } = await this.getTenantConnection(databaseId);
    const effectiveSchema = engine === "POSTGRESQL" ? (schema ?? "public") : databaseName;
    try {
      if (engine === "POSTGRESQL") {
        const res = await conn.query(
          `SELECT
             t.table_name,
             t.table_type,
             (SELECT reltuples::bigint FROM pg_class c WHERE c.relname = t.table_name) AS estimated_rows
           FROM information_schema.tables t
           WHERE t.table_schema = $1
           ORDER BY t.table_name`,
          [effectiveSchema],
        );
        return res.rows.map((r) => ({ name: r.table_name as string, type: r.table_type as string, estimatedRows: Number(r.estimated_rows ?? 0) }));
      }
      // MySQL/MariaDB expose row-count estimates directly on the table
      // metadata itself — no separate catalog lookup needed the way
      // Postgres's pg_class requires. Every column is explicitly aliased:
      // MySQL's information_schema returns field names in the catalog's
      // own (uppercase) case for anything not given an explicit alias,
      // unlike Postgres where an unquoted column reads back lowercase.
      const res = await conn.query(
        `SELECT table_name AS table_name, table_type AS table_type, table_rows AS estimated_rows
         FROM information_schema.tables
         WHERE table_schema = ?
         ORDER BY table_name`,
        [effectiveSchema],
      );
      return res.rows.map((r) => ({ name: r.table_name as string, type: r.table_type as string, estimatedRows: Number(r.estimated_rows ?? 0) }));
    } finally {
      await conn.end();
    }
  }

  async listColumns(databaseId: string, schema: string | undefined, table: string) {
    const { engine, databaseName, conn } = await this.getTenantConnection(databaseId);
    const effectiveSchema = engine === "POSTGRESQL" ? (schema ?? "public") : databaseName;
    const placeholder = engine === "POSTGRESQL" ? ["$1", "$2"] : ["?", "?"];
    try {
      // Explicit aliases on every column: MySQL's information_schema
      // returns field names in the catalog's own (uppercase) case for
      // anything not aliased, unlike Postgres's lowercase-by-default.
      const res = await conn.query(
        `SELECT column_name AS column_name, data_type AS data_type, is_nullable AS is_nullable, column_default AS column_default
         FROM information_schema.columns
         WHERE table_schema = ${placeholder[0]} AND table_name = ${placeholder[1]}
         ORDER BY ordinal_position`,
        [effectiveSchema, table],
      );
      return res.rows.map((r) => ({
        name: r.column_name as string,
        dataType: r.data_type as string,
        nullable: r.is_nullable === "YES",
        default: r.column_default as string | null,
      }));
    } finally {
      await conn.end();
    }
  }

  async listRows(databaseId: string, schema: string | undefined, table: string, page: number, pageSize: number): Promise<QueryResult & { totalRows: number }> {
    const { engine, databaseName, conn } = await this.getTenantConnection(databaseId);
    const effectiveSchema = engine === "POSTGRESQL" ? (schema ?? "public") : databaseName;
    const qSchema = quoteIdent(effectiveSchema, "schema", engine);
    const qTable = quoteIdent(table, "table", engine);
    const target = engine === "POSTGRESQL" ? `${qSchema}.${qTable}` : qTable; // MySQL: schema IS the connection's database, no qualifier needed
    const started = Date.now();
    try {
      const countRes = await conn.query(`SELECT COUNT(*) AS count FROM ${target}`);
      const offset = Math.max(0, (page - 1) * pageSize);
      const limitClause = engine === "POSTGRESQL" ? "LIMIT $1 OFFSET $2" : "LIMIT ? OFFSET ?";
      const res = await conn.query(`SELECT * FROM ${target} ${limitClause}`, [pageSize, offset]);
      return {
        columns: res.columns,
        rows: res.rows,
        rowCount: res.rowCount,
        totalRows: Number(countRes.rows[0]?.count ?? 0),
        durationMs: Date.now() - started,
      };
    } finally {
      await conn.end();
    }
  }

  async deleteRow(databaseId: string, schema: string | undefined, table: string, primaryKeyColumn: string, primaryKeyValue: unknown) {
    const { engine, databaseName, conn } = await this.getTenantConnection(databaseId);
    const effectiveSchema = engine === "POSTGRESQL" ? (schema ?? "public") : databaseName;
    const qSchema = quoteIdent(effectiveSchema, "schema", engine);
    const qTable = quoteIdent(table, "table", engine);
    const qCol = quoteIdent(primaryKeyColumn, "column", engine);
    const target = engine === "POSTGRESQL" ? `${qSchema}.${qTable}` : qTable;
    const placeholder = engine === "POSTGRESQL" ? "$1" : "?";
    try {
      const res = await conn.query(`DELETE FROM ${target} WHERE ${qCol} = ${placeholder}`, [primaryKeyValue]);
      return { deleted: res.rowCount ?? 0 };
    } finally {
      await conn.end();
    }
  }

  /** Runs arbitrary SQL from the SQL editor. Read and write statements are
   * both allowed (matching a real SQL editor) — isolation comes from the
   * connection being scoped to the tenant's own database and role/user,
   * for whichever of the three engines it is. */
  async runQuery(databaseId: string, sql: string): Promise<QueryResult> {
    if (!sql.trim()) throw new BadRequestException("SQL statement is empty");
    const { conn } = await this.getTenantConnection(databaseId);
    const started = Date.now();
    try {
      const res = await conn.query(sql);
      return { columns: res.columns, rows: res.rows, rowCount: res.rowCount, durationMs: Date.now() - started };
    } finally {
      await conn.end();
    }
  }

  /** Real, live metrics — not simulated: actual connection count and
   * on-disk size for the tenant's own database, queried through their own
   * connection, for whichever engine backs it. */
  async getMetrics(databaseId: string) {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    const { engine, databaseName, conn } = await this.getTenantConnection(databaseId);
    try {
      let connections: number;
      let sizeBytes: number;
      if (engine === "POSTGRESQL") {
        const [connectionsRes, sizeRes] = await Promise.all([
          conn.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()`),
          conn.query(`SELECT pg_database_size(current_database())::bigint AS bytes`),
        ]);
        connections = Number(connectionsRes.rows[0]?.count ?? 0);
        sizeBytes = Number(sizeRes.rows[0]?.bytes ?? 0);
      } else {
        const [connectionsRes, sizeRes] = await Promise.all([
          conn.query(`SELECT COUNT(*) AS count FROM information_schema.processlist WHERE db = ?`, [databaseName]),
          conn.query(`SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes FROM information_schema.tables WHERE table_schema = ?`, [databaseName]),
        ]);
        connections = Number(connectionsRes.rows[0]?.count ?? 0);
        sizeBytes = Number(sizeRes.rows[0]?.bytes ?? 0);
      }
      const storageLimitBytes = database.storageMb * 1024 * 1024;
      return {
        supported: true,
        connections,
        sizeBytes,
        storageLimitBytes,
        storagePct: storageLimitBytes > 0 ? Math.round((sizeBytes / storageLimitBytes) * 1000) / 10 : 0,
      };
    } finally {
      await conn.end();
    }
  }

  /** Real, live session listing — not a stored snapshot, so it always
   * reflects what's connected right now, for whichever engine backs this
   * database. */
  async listConnections(databaseId: string) {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    const { engine, databaseName, conn } = await this.getTenantConnection(databaseId);
    try {
      if (engine === "POSTGRESQL") {
        const res = await conn.query(
          `SELECT pid, usename, client_addr, state, query, query_start, backend_start
           FROM pg_stat_activity
           WHERE datname = current_database() AND pid <> pg_backend_pid()
           ORDER BY backend_start DESC`,
        );
        return {
          supported: true,
          connections: res.rows.map((r) => ({
            pid: r.pid as number,
            username: r.usename as string,
            clientAddr: (r.client_addr as string) ?? null,
            state: r.state as string,
            query: r.query as string,
            queryStart: r.query_start as Date | null,
            connectedAt: r.backend_start as Date,
          })),
        };
      }
      const res = await conn.query(
        `SELECT id AS id, user AS user, host AS host, command AS state, time AS time, info AS query
         FROM information_schema.processlist
         WHERE db = ? AND id <> CONNECTION_ID()
         ORDER BY time DESC`,
        [databaseName],
      );
      return {
        supported: true,
        connections: res.rows.map((r) => ({
          pid: Number(r.id),
          username: r.user as string,
          clientAddr: (r.host as string)?.split(":")[0] ?? null,
          state: r.state as string,
          query: (r.query as string) ?? "",
          queryStart: null,
          connectedAt: new Date(Date.now() - Number(r.time ?? 0) * 1000),
        })),
      };
    } finally {
      await conn.end();
    }
  }

  // ── Database users: additional scoped credentials on the tenant's own database ──

  async listUsers(databaseId: string) {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    return this.prisma.databaseUser.findMany({
      where: { databaseId },
      select: { id: true, databaseId: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Provisions a real, additional scoped credential on this database (e.g.
   * a read-only role for an analytics tool) — separate from the database's
   * own owner role/user created at provisioning time. The generated
   * password is shown once in the response, matching the pattern used for
   * the database's initial password and for API keys. */
  async createUser(databaseId: string, username: string, role: "readonly" | "readwrite") {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    const existing = await this.prisma.databaseUser.findUnique({
      where: { databaseId_username: { databaseId, username } },
    });
    if (existing) throw new BadRequestException("A user with that username already exists on this database");

    const roleName = `${database.databaseName}_${username}`;
    const password = crypto.randomBytes(18).toString("base64url");
    if (database.engine === "POSTGRESQL") {
      await this.postgresAdmin.createScopedRole(database.databaseName, roleName, password, role, database.username);
    } else {
      await this.mysqlAdmin.createScopedUser(database.databaseName, roleName, password, role);
    }

    const passwordCipher = encryptSecret(password, this.config.getOrThrow("ENCRYPTION_KEY"));
    const created = await this.prisma.databaseUser.create({
      data: { databaseId, username: roleName, passwordCipher, role },
    });
    return { ...created, password };
  }

  async deleteUser(databaseUserId: string) {
    const dbUser = await this.prisma.databaseUser.findUnique({ where: { id: databaseUserId } });
    if (!dbUser) throw new NotFoundException("Database user not found");
    const database = await this.prisma.database.findFirst({ where: { id: dbUser.databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");

    if (database.engine === "POSTGRESQL") {
      await this.postgresAdmin.dropScopedRole(database.databaseName, dbUser.username);
    } else {
      await this.mysqlAdmin.dropScopedUser(dbUser.username);
    }
    await this.prisma.databaseUser.delete({ where: { id: databaseUserId } });
    return { deleted: true };
  }

  // ── Saved queries ────────────────────────────────────────────────────
  async listSavedQueries(databaseId: string) {
    return this.prisma.savedQuery.findMany({ where: { databaseId }, orderBy: { updatedAt: "desc" } });
  }

  async saveQuery(databaseId: string, userId: string, name: string, sql: string) {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    return this.prisma.savedQuery.create({
      data: { databaseId, organizationId: database.organizationId, userId, name, sql },
    });
  }

  async deleteSavedQuery(queryId: string) {
    await this.prisma.savedQuery.delete({ where: { id: queryId } });
    return { deleted: true };
  }
}
