import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { DatabasesService } from "./databases.service";
import { CreateDatabaseDto } from "./dto/create-database.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("databases")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "databases", version: "1" })
export class DatabasesController {
  constructor(private readonly databasesService: DatabasesService) {}

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
  restore(@Param("databaseId") databaseId: string, @Body("backupId") backupId: string) {
    return this.databasesService.restoreBackup(databaseId, backupId);
  }
}
