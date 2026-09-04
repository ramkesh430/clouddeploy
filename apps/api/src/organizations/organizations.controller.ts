import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { InviteMemberDto } from "./dto/invite-member.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("organizations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: "organizations", version: "1" })
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: "List workspaces the current user belongs to" })
  list(@CurrentUser() user: RequestUser) {
    return this.organizationsService.listForUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new workspace / organization" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(user.id, user.email, dto);
  }

  @Get(":organizationId")
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Get a workspace by id" })
  findOne(@Param("organizationId") organizationId: string) {
    return this.organizationsService.findOne(organizationId);
  }

  @Get(":organizationId/members")
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "List workspace members" })
  listMembers(@Param("organizationId") organizationId: string) {
    return this.organizationsService.listMembers(organizationId);
  }

  @Post(":organizationId/members")
  @UseGuards(RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Invite a member to the workspace" })
  inviteMember(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizationsService.inviteMember(organizationId, user.id, dto);
  }

  @Delete(":organizationId/members/:memberId")
  @UseGuards(RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Remove a workspace member" })
  removeMember(
    @Param("organizationId") organizationId: string,
    @Param("memberId") memberId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organizationsService.removeMember(organizationId, memberId, user.id);
  }
}
