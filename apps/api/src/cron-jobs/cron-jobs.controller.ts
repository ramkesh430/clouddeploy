import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CronJobsService } from "./cron-jobs.service";
import { CreateCronJobDto } from "./dto/create-cron-job.dto";
import { UpdateCronJobDto } from "./dto/update-cron-job.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("cron-jobs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "cron-jobs", version: "1" })
export class CronJobsController {
  constructor(private readonly cronJobsService: CronJobsService) {}

  @Get()
  @ApiOperation({ summary: "List cron jobs for a project" })
  list(@Query("projectId") projectId: string) {
    return this.cronJobsService.list(projectId);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Create a cron job" })
  create(@Body() dto: CreateCronJobDto) {
    return this.cronJobsService.create(dto);
  }

  @Get(":cronJobId")
  @ApiOperation({ summary: "Get cron job details + recent executions" })
  findOne(@Param("cronJobId") cronJobId: string) {
    return this.cronJobsService.findOne(cronJobId);
  }

  @Patch(":cronJobId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Update a cron job" })
  update(@Param("cronJobId") cronJobId: string, @Body() dto: UpdateCronJobDto) {
    return this.cronJobsService.update(cronJobId, dto);
  }

  @Post(":cronJobId/pause")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Pause a cron job" })
  pause(@Param("cronJobId") cronJobId: string) {
    return this.cronJobsService.pause(cronJobId);
  }

  @Post(":cronJobId/resume")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Resume a paused cron job" })
  resume(@Param("cronJobId") cronJobId: string) {
    return this.cronJobsService.resume(cronJobId);
  }

  @Post(":cronJobId/trigger")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Manually trigger a run" })
  trigger(@Param("cronJobId") cronJobId: string) {
    return this.cronJobsService.trigger(cronJobId);
  }

  @Get(":cronJobId/executions")
  @ApiOperation({ summary: "List execution history" })
  executions(@Param("cronJobId") cronJobId: string) {
    return this.cronJobsService.listExecutions(cronJobId);
  }

  @Delete(":cronJobId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Delete a cron job" })
  remove(@Param("cronJobId") cronJobId: string) {
    return this.cronJobsService.remove(cronJobId);
  }
}
