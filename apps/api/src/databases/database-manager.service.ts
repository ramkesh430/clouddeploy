import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import crypto from "node:crypto";
import { decryptSecret, encryptSecret } from "@clouddeploy/security";
import { PrismaService } from "../prisma/prisma.service";
import { PostgresAdminService } from "./postgres-admin.service";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

function quoteIdent(value: string, label: string): string {
  if (!IDENTIFIER.test(value)) {
    throw new BadRequestException(`Invalid ${label}: ${value}`);
  }
  return `"${value}"`;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

interface QueryResultLike {
  fields?: { name: string }[];
  rows?: Record<string, unknown>[];
  rowCount?: number | null;
}

/**
 * Table browser + SQL editor backend. Every query here runs through a pool
 * authenticated as the tenant's own Postgres role against their own
 * database — Postgres' native per-database isolation is what actually keeps
 * tenants apart, not application-level filtering.
 */
@Injectable()
export class DatabaseManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly postgresAdmin: PostgresAdminService,
  ) {}

  private async getTenantPool(databaseId: string) {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    if (database.engine !== "POSTGRESQL") {
      throw new BadRequestException("The table browser and SQL editor currently support PostgreSQL only");
    }
    const password = decryptSecret(database.passwordCipher, this.config.getOrThrow("ENCRYPTION_KEY"));
    return this.postgresAdmin.createTenantPool(database.databaseName, database.username, password);
  }

  async listSchemas(databaseId: string): Promise<string[]> {
    const pool = await this.getTenantPool(databaseId);
    try {
      const res = await pool.query(
        `SELECT schema_name FROM information_schema.schemata
         WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
         ORDER BY schema_name`,
      );
      return res.rows.map((r) => r.schema_name as string);
    } finally {
      await pool.end();
    }
  }

  async listTables(databaseId: string, schema = "public") {
    const pool = await this.getTenantPool(databaseId);
    try {
      const res = await pool.query(
        `SELECT
           t.table_name,
           t.table_type,
           (SELECT reltuples::bigint FROM pg_class c WHERE c.relname = t.table_name) AS estimated_rows
         FROM information_schema.tables t
         WHERE t.table_schema = $1
         ORDER BY t.table_name`,
        [schema],
      );
      return res.rows.map((r) => ({
        name: r.table_name as string,
        type: r.table_type as string,
        estimatedRows: Number(r.estimated_rows ?? 0),
      }));
    } finally {
      await pool.end();
    }
  }

  async listColumns(databaseId: string, schema: string, table: string) {
    const pool = await this.getTenantPool(databaseId);
    try {
      const res = await pool.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schema, table],
      );
      return res.rows.map((r) => ({
        name: r.column_name as string,
        dataType: r.data_type as string,
        nullable: r.is_nullable === "YES",
        default: r.column_default as string | null,
      }));
    } finally {
      await pool.end();
    }
  }

  async listRows(
    databaseId: string,
    schema: string,
    table: string,
    page: number,
    pageSize: number,
  ): Promise<QueryResult & { totalRows: number }> {
    const qSchema = quoteIdent(schema, "schema");
    const qTable = quoteIdent(table, "table");
    const pool = await this.getTenantPool(databaseId);
    const started = Date.now();
    try {
      const countRes = await pool.query(`SELECT COUNT(*)::bigint AS count FROM ${qSchema}.${qTable}`);
      const offset = Math.max(0, (page - 1) * pageSize);
      const res = await pool.query(`SELECT * FROM ${qSchema}.${qTable} LIMIT $1 OFFSET $2`, [pageSize, offset]);
      return {
        columns: res.fields.map((f) => f.name),
        rows: res.rows,
        rowCount: res.rowCount ?? 0,
        totalRows: Number(countRes.rows[0]?.count ?? 0),
        durationMs: Date.now() - started,
      };
    } finally {
      await pool.end();
    }
  }

  async deleteRow(databaseId: string, schema: string, table: string, primaryKeyColumn: string, primaryKeyValue: unknown) {
    const qSchema = quoteIdent(schema, "schema");
    const qTable = quoteIdent(table, "table");
    const qCol = quoteIdent(primaryKeyColumn, "column");
    const pool = await this.getTenantPool(databaseId);
    try {
      const res = await pool.query(`DELETE FROM ${qSchema}.${qTable} WHERE ${qCol} = $1`, [primaryKeyValue]);
      return { deleted: res.rowCount ?? 0 };
    } finally {
      await pool.end();
    }
  }

  /** Runs arbitrary SQL from the SQL editor. Read and write statements are
   * both allowed (matching a real SQL editor) — isolation comes from the
   * connection being scoped to the tenant's own database and role. */
  async runQuery(databaseId: string, sql: string): Promise<QueryResult> {
    if (!sql.trim()) throw new BadRequestException("SQL statement is empty");
    const pool = await this.getTenantPool(databaseId);
    const started = Date.now();
    try {
      const res = await pool.query<Record<string, unknown>>(sql);
      const result: QueryResultLike = Array.isArray(res) ? res[res.length - 1] : res;
      return {
        columns: (result.fields ?? []).map((f: { name: string }) => f.name),
        rows: result.rows ?? [],
        rowCount: result.rowCount ?? 0,
        durationMs: Date.now() - started,
      };
    } finally {
      await pool.end();
    }
  }

  /** Real, live metrics — not simulated: actual connection count and
   * on-disk size for the tenant's own database, queried through their own
   * connection. */
  async getMetrics(databaseId: string) {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    if (database.engine !== "POSTGRESQL") {
      return { supported: false, reason: "Live metrics currently support PostgreSQL only" };
    }

    const pool = await this.getTenantPool(databaseId);
    try {
      const [connectionsRes, sizeRes] = await Promise.all([
        pool.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()`),
        pool.query(`SELECT pg_database_size(current_database())::bigint AS bytes`),
      ]);
      const connections = connectionsRes.rows[0]?.count ?? 0;
      const sizeBytes = Number(sizeRes.rows[0]?.bytes ?? 0);
      const storageLimitBytes = database.storageMb * 1024 * 1024;
      return {
        supported: true,
        connections,
        sizeBytes,
        storageLimitBytes,
        storagePct: storageLimitBytes > 0 ? Math.round((sizeBytes / storageLimitBytes) * 1000) / 10 : 0,
      };
    } finally {
      await pool.end();
    }
  }

  /** Real, live session listing from pg_stat_activity for the tenant's own
   * database — not a stored snapshot, so it always reflects what's
   * connected right now. */
  async listConnections(databaseId: string) {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    if (database.engine !== "POSTGRESQL") {
      return { supported: false, reason: "Live connections currently support PostgreSQL only" };
    }

    const pool = await this.getTenantPool(databaseId);
    try {
      const res = await pool.query(
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
    } finally {
      await pool.end();
    }
  }

  // ── Database users: additional scoped Postgres roles ────────────────

  async listUsers(databaseId: string) {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    return this.prisma.databaseUser.findMany({
      where: { databaseId },
      select: { id: true, databaseId: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Provisions a real, additional Postgres role scoped to this database
   * (e.g. a read-only credential for an analytics tool) — separate from the
   * database's own owner role. The generated password is shown once in the
   * response, matching the pattern used for the database's initial
   * password and for API keys. */
  async createUser(databaseId: string, username: string, role: "readonly" | "readwrite") {
    const database = await this.prisma.database.findFirst({ where: { id: databaseId, deletedAt: null } });
    if (!database) throw new NotFoundException("Database not found");
    if (database.engine !== "POSTGRESQL") {
      throw new BadRequestException("Database users currently support PostgreSQL only");
    }
    const existing = await this.prisma.databaseUser.findUnique({
      where: { databaseId_username: { databaseId, username } },
    });
    if (existing) throw new BadRequestException("A user with that username already exists on this database");

    const roleName = `${database.databaseName}_${username}`;
    const password = crypto.randomBytes(18).toString("base64url");
    await this.postgresAdmin.createScopedRole(database.databaseName, roleName, password, role, database.username);

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

    await this.postgresAdmin.dropScopedRole(database.databaseName, dbUser.username);
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
