import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { DatabasesService } from "./databases.service";
import { DatabaseManagerService } from "./database-manager.service";
import { CreateDatabaseDto } from "./dto/create-database.dto";
import { CreateDatabaseUserDto } from "./dto/create-database-user.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("databases")
@ApiBearerAuth()
@UseGuards(AnyAuthGuard, RolesGuard)
@Controller({ path: "databases", version: "1" })
export class DatabasesController {
  constructor(
    private readonly databasesService: DatabasesService,
    private readonly databaseManager: DatabaseManagerService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List managed databases in a workspace" })
  list(@Query("organizationId") organizationId: string) {
    return this.databasesService.list(organizationId);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Create a managed database" })
  create(@Body() dto: CreateDatabaseDto) {
    return this.databasesService.create(dto);
  }

  @Get(":databaseId")
  @ApiOperation({ summary: "Get database details" })
  findOne(@Param("databaseId") databaseId: string) {
    return this.databasesService.findOne(databaseId);
  }

  @Get(":databaseId/metrics")
  @ApiOperation({ summary: "Real live metrics: connection count and on-disk size" })
  metrics(@Param("databaseId") databaseId: string) {
    return this.databaseManager.getMetrics(databaseId);
  }

  @Get(":databaseId/connection")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Get connection credentials (host, port, connection URL)" })
  connection(@Param("databaseId") databaseId: string) {
    return this.databasesService.getConnectionInfo(databaseId);
  }

  @Post(":databaseId/rotate-password")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Rotate the database password" })
  rotatePassword(@Param("databaseId") databaseId: string) {
    return this.databasesService.rotatePassword(databaseId);
  }

  @Post(":databaseId/restart")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Restart the database" })
  restart(@Param("databaseId") databaseId: string) {
    return this.databasesService.restart(databaseId);
  }

  @Post(":databaseId/backup")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Create a manual backup" })
  backup(@Param("databaseId") databaseId: string) {
    return this.databasesService.createBackup(databaseId, "MANUAL");
  }

  @Get(":databaseId/backups")
  @ApiOperation({ summary: "List backups" })
  listBackups(@Param("databaseId") databaseId: string) {
    return this.databasesService.listBackups(databaseId);
  }

  @Post(":databaseId/restore")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Restore from a backup" })
  restore(@Param("databaseId") databaseId: string, @Body("backupId") backupId: string, @CurrentUser() user: RequestUser) {
    return this.databasesService.restoreBackup(databaseId, backupId, user.id);
  }

  @Delete(":databaseId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Delete a database (drops the real Postgres database + role, soft-deletes the record)" })
  remove(@Param("databaseId") databaseId: string) {
    return this.databasesService.remove(databaseId);
  }

  // ── Database Manager: table browser + SQL editor ────────────────────

  @Get(":databaseId/connections")
  @ApiOperation({ summary: "Real live session list from pg_stat_activity" })
  listConnections(@Param("databaseId") databaseId: string) {
    return this.databaseManager.listConnections(databaseId);
  }

  @Get(":databaseId/users")
  @ApiOperation({ summary: "List additional scoped Postgres roles for this database" })
  listUsers(@Param("databaseId") databaseId: string) {
    return this.databaseManager.listUsers(databaseId);
  }

  @Post(":databaseId/users")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Create a real, additional scoped Postgres role (e.g. read-only for analytics)" })
  createUser(@Param("databaseId") databaseId: string, @Body() dto: CreateDatabaseUserDto) {
    return this.databaseManager.createUser(databaseId, dto.username, dto.role ?? "readonly");
  }

  @Delete(":databaseId/users/:databaseUserId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Drop a scoped database user's Postgres role" })
  deleteUser(@Param("databaseUserId") databaseUserId: string) {
    return this.databaseManager.deleteUser(databaseUserId);
  }

  @Get(":databaseId/schemas")
  @ApiOperation({ summary: "List schemas" })
  listSchemas(@Param("databaseId") databaseId: string) {
    return this.databaseManager.listSchemas(databaseId);
  }

  @Get(":databaseId/tables")
  @ApiOperation({ summary: "List tables in a schema" })
  listTables(@Param("databaseId") databaseId: string, @Query("schema") schema?: string) {
    return this.databaseManager.listTables(databaseId, schema);
  }

  @Get(":databaseId/tables/:table/columns")
  @ApiOperation({ summary: "List columns for a table" })
  listColumns(
    @Param("databaseId") databaseId: string,
    @Param("table") table: string,
    @Query("schema") schema = "public",
  ) {
    return this.databaseManager.listColumns(databaseId, schema, table);
  }

  @Get(":databaseId/tables/:table/rows")
  @ApiOperation({ summary: "Paginated row browser for a table" })
  listRows(
    @Param("databaseId") databaseId: string,
    @Param("table") table: string,
    @Query("schema") schema = "public",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "50",
  ) {
    return this.databaseManager.listRows(databaseId, schema, table, Number(page), Number(pageSize));
  }

  @Delete(":databaseId/tables/:table/rows")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Delete a single row by primary key" })
  deleteRow(
    @Param("databaseId") databaseId: string,
    @Param("table") table: string,
    @Query("schema") schema = "public",
    @Body("column") column?: string,
    @Body("value") value?: unknown,
  ) {
    return this.databaseManager.deleteRow(databaseId, schema, table, column!, value);
  }

  @Post(":databaseId/query")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Run a SQL statement in the SQL editor" })
  runQuery(@Param("databaseId") databaseId: string, @Body("sql") sql: string) {
    return this.databaseManager.runQuery(databaseId, sql);
  }

  @Get(":databaseId/saved-queries")
  @ApiOperation({ summary: "List saved SQL editor queries" })
  listSavedQueries(@Param("databaseId") databaseId: string) {
    return this.databaseManager.listSavedQueries(databaseId);
  }

  @Post(":databaseId/saved-queries")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Save a SQL editor query" })
  saveQuery(
    @Param("databaseId") databaseId: string,
    @Body("name") name: string,
    @Body("sql") sql: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.databaseManager.saveQuery(databaseId, user.id, name, sql);
  }

  @Delete(":databaseId/saved-queries/:queryId")
  @ApiOperation({ summary: "Delete a saved query" })
  deleteSavedQuery(@Param("queryId") queryId: string) {
    return this.databaseManager.deleteSavedQuery(queryId);
  }
}
