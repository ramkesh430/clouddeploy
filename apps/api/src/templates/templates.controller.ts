import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { TemplatesService } from "./templates.service";
import { DeployTemplateDto } from "./dto/deploy-template.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("templates")
@Controller({ path: "templates", version: "1" })
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get("categories")
  @ApiOperation({ summary: "List template categories" })
  listCategories() {
    return this.templatesService.listCategories();
  }

  @Get()
  @ApiOperation({ summary: "Browse the template marketplace (public platform templates + your org's own)" })
  list(@Query("organizationId") organizationId?: string) {
    return this.templatesService.list(organizationId);
  }

  @Get(":templateId")
  @ApiOperation({ summary: "Get a template's full definition" })
  findOne(@Param("templateId") templateId: string) {
    return this.templatesService.findOne(templateId);
  }

  @Post(":templateId/deploy")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "One-click deploy: provisions a real project, service, database/Redis, and queues a real deployment" })
  deploy(@Param("templateId") templateId: string, @Body() dto: DeployTemplateDto, @CurrentUser() user: RequestUser) {
    return this.templatesService.deploy(templateId, dto, user.id);
  }
}
