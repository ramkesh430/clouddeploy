import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OrgRole } from "@clouddeploy/database";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { withDefault } from "../common/utils/pagination.util";
import { AgencyService } from "./agency.service";
import { AssignClientProjectDto, CreateAgencyClientDto, UpdateAgencyClientDto, UpdateBrandingDto, UpdatePortalAccessDto } from "./dto/agency.dto";

@ApiTags("agency")
@ApiBearerAuth()
@UseGuards(AnyAuthGuard, RolesGuard)
@Controller({ path: "agency", version: "1" })
export class AgencyController {
  constructor(private readonly agency: AgencyService) {}

  @Get("dashboard")
  dashboard(@Query("organizationId") organizationId: string) { return this.agency.dashboard(organizationId); }

  @Get("clients")
  clients(@Query("organizationId") organizationId: string, @Query("limit") limit?: number, @Query("cursor") cursor?: string) {
    return this.agency.listClients(organizationId, withDefault(limit, 50), cursor);
  }

  @Post("clients")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  createClient(@Body() dto: CreateAgencyClientDto) { return this.agency.createClient(dto); }

  @Get("clients/:clientId")
  client(@Param("clientId") clientId: string) { return this.agency.clientDetail(clientId); }

  @Patch("clients/:clientId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  updateClient(@Param("clientId") clientId: string, @Body() dto: UpdateAgencyClientDto) { return this.agency.updateClient(clientId, dto); }

  @Post("clients/:clientId/projects")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  assignProject(@Param("clientId") clientId: string, @Body() dto: AssignClientProjectDto) { return this.agency.assignProject(clientId, dto); }

  @Delete("clients/:clientId/projects/:projectId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  removeProject(@Param("clientId") clientId: string, @Param("projectId") projectId: string) { return this.agency.removeProject(clientId, projectId); }

  @Get("branding")
  branding(@Query("organizationId") organizationId: string) { return this.agency.branding(organizationId); }

  @Patch("branding")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  updateBranding(@Body() dto: UpdateBrandingDto) { return this.agency.updateBranding(dto); }

  @Patch("clients/:clientId/portal-access")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  updatePortalAccess(@Param("clientId") clientId: string, @Body() dto: UpdatePortalAccessDto) { return this.agency.updatePortalAccess(clientId, dto); }
}
