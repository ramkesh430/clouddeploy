import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decryptSecret } from "@clouddeploy/security";
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
