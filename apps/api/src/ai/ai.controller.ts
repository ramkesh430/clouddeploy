import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrgRole } from "@clouddeploy/database";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AiService } from "./ai.service";
import { AnalyzeLogsDto, AnalyzeRepositoryDto, ApplyFixDto, GenerateDockerfileDto, RecommendResourcesDto, RejectFixDto } from "./dto/ai-analysis.dto";

@ApiTags("ai")
@ApiBearerAuth()
@UseGuards(AnyAuthGuard, RolesGuard)
@Controller({ path: "ai", version: "1" })
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("repository-analysis")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Analyze a sanitized repository snapshot and return structured deployment recommendations" })
  analyzeRepository(@Body() dto: AnalyzeRepositoryDto, @CurrentUser() user: RequestUser) {
    return this.ai.analyzeRepository(dto, user.id);
  }

  @Post("log-analysis")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Explain a deployment failure and create review-required safe fix proposals" })
  analyzeLogs(@Body() dto: AnalyzeLogsDto, @CurrentUser() user: RequestUser) {
    return this.ai.analyzeLogs(dto, user.id);
  }

  @Post("dockerfile")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Generate a reviewable Dockerfile without writing to the Git repository" })
  generateDockerfile(@Body() dto: GenerateDockerfileDto, @CurrentUser() user: RequestUser) {
    return this.ai.generateDockerfile(dto, user.id);
  }

  @Post("resource-recommendations")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  recommendResources(@Body() dto: RecommendResourcesDto, @CurrentUser() user: RequestUser) {
    return this.ai.recommendResources(dto, user.id);
  }

  @Get("analyses")
  list(@Query("organizationId") organizationId: string, @Query("projectId") projectId?: string) {
    return this.ai.list(organizationId, projectId);
  }

  @Post("fixes/:proposalId/apply")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Approve and apply one AI-proposed action" })
  apply(@Param("proposalId") proposalId: string, @Body() dto: ApplyFixDto, @CurrentUser() user: RequestUser) {
    return this.ai.applyFix(proposalId, dto, user.id);
  }

  @Post("fixes/:proposalId/reject")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  reject(@Param("proposalId") proposalId: string, @Body() dto: RejectFixDto) {
    return this.ai.rejectFix(proposalId, dto.reason);
  }
}
