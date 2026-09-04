import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { CurrentOrgRole } from "../common/decorators/current-org-role.decorator";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { OrgRole } from "@clouddeploy/database";

/**
 * Uses AnyAuthGuard (user JWT OR platform API key) rather than JwtAuthGuard
 * — this is the one controller wired up as the concrete demonstration of
 * API-key authentication (see section 74/115 of the spec: "Projects Read/
 * Write" is exactly the permission scope API keys are meant to cover).
 */
@ApiTags("projects")
@ApiBearerAuth()
@UseGuards(AnyAuthGuard, RolesGuard)
@Controller({ path: "projects", version: "1" })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: "List projects in a workspace (DEVELOPER/VIEWER see only projects they created or were granted access to)" })
  list(@Query("organizationId") organizationId: string, @CurrentUser() user: RequestUser, @CurrentOrgRole() orgRole?: string) {
    return this.projectsService.list(organizationId, user.id, orgRole);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Create a new project" })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: RequestUser) {
    return this.projectsService.create(dto.organizationId, user.id, dto);
  }

  @Get(":projectId")
  @ApiOperation({ summary: "Get project details" })
  findOne(@Param("projectId") projectId: string, @CurrentUser() user: RequestUser, @CurrentOrgRole() orgRole?: string) {
    return this.projectsService.findOne(projectId, user.id, orgRole);
  }

  @Patch(":projectId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Update project settings" })
  update(@Param("projectId") projectId: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(projectId, dto);
  }

  @Post(":projectId/pause")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Pause a project" })
  pause(@Param("projectId") projectId: string) {
    return this.projectsService.pause(projectId);
  }

  @Post(":projectId/resume")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Resume a paused project" })
  resume(@Param("projectId") projectId: string) {
    return this.projectsService.resume(projectId);
  }

  @Post(":projectId/archive")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Archive a project" })
  archive(@Param("projectId") projectId: string) {
    return this.projectsService.archive(projectId);
  }

  @Delete(":projectId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Delete a project (soft delete)" })
  remove(@Param("projectId") projectId: string) {
    return this.projectsService.remove(projectId);
  }

  @Get(":projectId/members")
  @ApiOperation({ summary: "List users granted explicit access to this project" })
  listMembers(@Param("projectId") projectId: string) {
    return this.projectsService.listMembers(projectId);
  }

  @Post(":projectId/members")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Grant a workspace member access to this project" })
  addMember(@Param("projectId") projectId: string, @Body("userId") userId: string) {
    return this.projectsService.addMember(projectId, userId);
  }

  @Delete(":projectId/members/:memberId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Revoke a member's project-level access" })
  removeMember(@Param("projectId") projectId: string, @Param("memberId") memberId: string) {
    return this.projectsService.removeMember(projectId, memberId);
  }
}
