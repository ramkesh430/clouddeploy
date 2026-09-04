import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("projects")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "projects", version: "1" })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: "List projects in a workspace" })
  list(@Query("organizationId") organizationId: string) {
    return this.projectsService.list(organizationId);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Create a new project" })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: RequestUser) {
    return this.projectsService.create(dto.organizationId, user.id, dto);
  }

  @Get(":projectId")
  @ApiOperation({ summary: "Get project details" })
  findOne(@Param("projectId") projectId: string) {
    return this.projectsService.findOne(projectId);
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
}
