import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { EnvironmentVariablesService } from "./environment-variables.service";
import { CreateEnvVarDto } from "./dto/create-env-var.dto";
import { BulkImportEnvDto } from "./dto/bulk-import-env.dto";
import { EnvironmentTarget, OrgRole } from "@clouddeploy/database";

@ApiTags("environment-variables")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
@Controller({ path: "environment-variables", version: "1" })
export class EnvironmentVariablesController {
  constructor(private readonly envVarsService: EnvironmentVariablesService) {}

  @Get()
  @ApiOperation({ summary: "List environment variables (values masked unless plaintext)" })
  list(
    @Query("projectId") projectId: string,
    @Query("serviceId") serviceId?: string,
    @Query("environment") environment?: EnvironmentTarget,
  ) {
    return this.envVarsService.list(projectId, { serviceId, environment });
  }

  @Get(":envVarId/reveal")
  @ApiOperation({ summary: "Reveal the plaintext value of a secret variable" })
  reveal(@Param("envVarId") envVarId: string) {
    return this.envVarsService.reveal(envVarId);
  }

  @Post()
  @ApiOperation({ summary: "Add an environment variable" })
  create(@Body() dto: CreateEnvVarDto, @CurrentUser() user: RequestUser) {
    return this.envVarsService.create(dto, user.id);
  }

  @Post("bulk-import")
  @ApiOperation({ summary: "Bulk import from pasted .env content" })
  bulkImport(@Body() dto: BulkImportEnvDto, @CurrentUser() user: RequestUser) {
    return this.envVarsService.bulkImport(dto, user.id);
  }

  @Patch(":envVarId")
  @ApiOperation({ summary: "Update the value of an environment variable" })
  update(@Param("envVarId") envVarId: string, @Body("value") value: string, @CurrentUser() user: RequestUser) {
    return this.envVarsService.update(envVarId, value, user.id);
  }

  @Delete(":envVarId")
  @ApiOperation({ summary: "Delete an environment variable" })
  remove(@Param("envVarId") envVarId: string) {
    return this.envVarsService.remove(envVarId);
  }
}
