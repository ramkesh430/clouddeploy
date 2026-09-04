import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { DeploymentsService } from "./deployments.service";
import { CreateDeploymentDto } from "./dto/create-deployment.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("deployments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "deployments", version: "1" })
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Get()
  @ApiOperation({ summary: "List deployments for a project" })
  list(@Query("projectId") projectId: string) {
    return this.deploymentsService.list(projectId);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Deploy Full Stack — create and run a new deployment" })
  create(@Body() dto: CreateDeploymentDto, @CurrentUser() user: RequestUser) {
    return this.deploymentsService.create(dto, user.id);
  }

  @Get(":deploymentId")
  @ApiOperation({ summary: "Get deployment details, including logs" })
  findOne(@Param("deploymentId") deploymentId: string) {
    return this.deploymentsService.findOne(deploymentId);
  }

  @Post(":deploymentId/redeploy")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Redeploy using the same branch and configuration" })
  redeploy(@Param("deploymentId") deploymentId: string, @CurrentUser() user: RequestUser) {
    return this.deploymentsService.redeploy(deploymentId, user.id);
  }

  @Post(":deploymentId/rollback")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Roll back to a previous healthy deployment" })
  rollback(
    @Param("deploymentId") deploymentId: string,
    @Body("targetDeploymentId") targetDeploymentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.deploymentsService.rollback(deploymentId, targetDeploymentId, user.id);
  }

  @Post(":deploymentId/cancel")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Cancel a running deployment" })
  cancel(@Param("deploymentId") deploymentId: string) {
    return this.deploymentsService.cancel(deploymentId);
  }
}
