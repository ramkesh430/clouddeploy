import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { AddSupportMessageDto, UpdateSupportTicketDto } from "../support/dto/support.dto";
import { SupportService } from "../support/support.service";
import { EncryptionRotationService } from "../security-settings/encryption-rotation.service";
import { withDefault } from "../common/utils/pagination.util";
import {
  CreateAdminDomainDto,
  CreateAdminProjectDto,
  CreateAdminUserDto,
  CreateOrganizationDto,
  CreatePlanDto,
  UpdateAdminDomainDto,
  UpdateAdminProjectDto,
  UpdateAdminUserDto,
  UpdateOrganizationDto,
  UpdatePlanDto,
} from "./dto/admin-crud.dto";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller({ path: "admin", version: "1" })
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly support: SupportService,
    private readonly encryptionRotation: EncryptionRotationService,
  ) {}
  @Get("dashboard") dashboard() { return this.admin.dashboard(); }
  @Get("analytics") analytics(@Query("days") days?: number) { return this.admin.analytics(withDefault(days, 30)); }
  @Get("growth") growth(@Query("metric") metric: "users" | "organizations" | "projects" | "deployments" | "revenue" = "users", @Query("days") days?: number) { return this.admin.growth(metric, withDefault(days, 30)); }
  @Get("users") users(@Query("limit") limit?: number, @Query("cursor") cursor?: string) { return this.admin.users(withDefault(limit, 50), cursor); }
  @Post("users") createUser(@Body() dto: CreateAdminUserDto) { return this.admin.createUser(dto); }
  @Patch("users/:userId") updateUser(@Param("userId") userId: string, @Body() dto: UpdateAdminUserDto, @CurrentUser() user: RequestUser) { return this.admin.updateUser(userId, dto, user.id); }
  @Delete("users/:userId") deleteUser(@Param("userId") userId: string, @CurrentUser() user: RequestUser) { return this.admin.deleteUser(userId, user.id); }
  @Post("users/:userId/suspend") suspend(@Param("userId") userId: string, @Body("reason") reason: string) { return this.admin.suspendUser(userId, reason); }
  @Post("users/:userId/resume") resume(@Param("userId") userId: string) { return this.admin.resumeUser(userId); }
  @Get("organizations") organizations(@Query("limit") limit?: number, @Query("cursor") cursor?: string) { return this.admin.organizations(withDefault(limit, 50), cursor); }
  @Post("organizations") createOrganization(@Body() dto: CreateOrganizationDto) { return this.admin.createOrganization(dto); }
  @Patch("organizations/:organizationId") updateOrganization(@Param("organizationId") organizationId: string, @Body() dto: UpdateOrganizationDto) { return this.admin.updateOrganization(organizationId, dto); }
  @Delete("organizations/:organizationId") deleteOrganization(@Param("organizationId") organizationId: string) { return this.admin.deleteOrganization(organizationId); }
  @Get("projects") projects(@Query("limit") limit?: number, @Query("cursor") cursor?: string) { return this.admin.projects(withDefault(limit, 50), cursor); }
  @Post("projects") createProject(@Body() dto: CreateAdminProjectDto) { return this.admin.createProject(dto); }
  @Patch("projects/:projectId") updateProject(@Param("projectId") projectId: string, @Body() dto: UpdateAdminProjectDto) { return this.admin.updateProject(projectId, dto); }
  @Delete("projects/:projectId") deleteProject(@Param("projectId") projectId: string) { return this.admin.deleteProject(projectId); }
  @Get("deployments") deployments(@Query("limit") limit?: number) { return this.admin.deployments(withDefault(limit, 50)); }
  @Get("services") services(@Query("limit") limit?: number) { return this.admin.services(withDefault(limit, 100)); }
  @Get("storage-buckets") storageBuckets(@Query("limit") limit?: number) { return this.admin.storageBuckets(withDefault(limit, 100)); }
  @Get("databases") databases(@Query("limit") limit?: number) { return this.admin.databases(withDefault(limit, 50)); }
  @Get("containers") containers(@Query("limit") limit?: number) { return this.admin.containers(withDefault(limit, 100)); }
  @Get("domains") domains(@Query("limit") limit?: number) { return this.admin.domains(withDefault(limit, 100)); }
  @Post("domains") createDomain(@Body() dto: CreateAdminDomainDto) { return this.admin.createDomain(dto); }
  @Patch("domains/:domainId") updateDomain(@Param("domainId") domainId: string, @Body() dto: UpdateAdminDomainDto) { return this.admin.updateDomain(domainId, dto); }
  @Delete("domains/:domainId") deleteDomain(@Param("domainId") domainId: string) { return this.admin.deleteDomain(domainId); }
  @Get("plans") plans() { return this.admin.plans(); }
  @Post("plans") createPlan(@Body() dto: CreatePlanDto) { return this.admin.createPlan(dto); }
  @Patch("plans/:planId") updatePlan(@Param("planId") planId: string, @Body() dto: UpdatePlanDto) { return this.admin.updatePlan(planId, dto); }
  @Delete("plans/:planId") deletePlan(@Param("planId") planId: string) { return this.admin.deletePlan(planId); }
  @Get("subscriptions") subscriptions(@Query("limit") limit?: number) { return this.admin.subscriptions(withDefault(limit, 100)); }
  @Get("transactions") transactions(@Query("limit") limit?: number) { return this.admin.transactions(withDefault(limit, 50)); }
  @Get("usage") usage(@Query("limit") limit?: number) { return this.admin.usage(withDefault(limit, 100)); }
  @Get("system-logs") logs(@Query("limit") limit?: number) { return this.admin.logs(withDefault(limit, 100)); }
  @Get("security") security() { return this.admin.security(); }
  @Post("security/rotate-encryption-key") rotateEncryptionKey(@CurrentUser() user: RequestUser) { return this.encryptionRotation.rotate(user.id); }
  @Get("support/tickets") tickets(@CurrentUser() user: RequestUser) { return this.support.list("", user.id, true); }
  @Patch("support/tickets/:ticketId") updateTicket(@Param("ticketId") ticketId: string, @Body() dto: UpdateSupportTicketDto) { return this.support.update(ticketId, dto); }
  @Post("support/tickets/:ticketId/messages") reply(@Param("ticketId") ticketId: string, @Body() dto: AddSupportMessageDto, @CurrentUser() user: RequestUser) { return this.support.addMessage(ticketId, dto, user.id, true); }
}
