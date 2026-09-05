import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { AddSupportMessageDto, UpdateSupportTicketDto } from "../support/dto/support.dto";
import { SupportService } from "../support/support.service";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller({ path: "admin", version: "1" })
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly support: SupportService) {}
  @Get("dashboard") dashboard() { return this.admin.dashboard(); }
  @Get("analytics") analytics(@Query("days") days?: number) { return this.admin.analytics(days); }
  @Get("users") users(@Query("limit") limit?: number, @Query("cursor") cursor?: string) { return this.admin.users(limit, cursor); }
  @Post("users/:userId/suspend") suspend(@Param("userId") userId: string, @Body("reason") reason: string) { return this.admin.suspendUser(userId, reason); }
  @Post("users/:userId/resume") resume(@Param("userId") userId: string) { return this.admin.resumeUser(userId); }
  @Get("organizations") organizations(@Query("limit") limit?: number, @Query("cursor") cursor?: string) { return this.admin.organizations(limit, cursor); }
  @Get("projects") projects(@Query("limit") limit?: number, @Query("cursor") cursor?: string) { return this.admin.projects(limit, cursor); }
  @Get("deployments") deployments(@Query("limit") limit?: number) { return this.admin.deployments(limit); }
  @Get("databases") databases(@Query("limit") limit?: number) { return this.admin.databases(limit); }
  @Get("containers") containers(@Query("limit") limit?: number) { return this.admin.containers(limit); }
  @Get("domains") domains(@Query("limit") limit?: number) { return this.admin.domains(limit); }
  @Get("plans") plans() { return this.admin.plans(); }
  @Get("subscriptions") subscriptions(@Query("limit") limit?: number) { return this.admin.subscriptions(limit); }
  @Get("transactions") transactions(@Query("limit") limit?: number) { return this.admin.transactions(limit); }
  @Get("usage") usage(@Query("limit") limit?: number) { return this.admin.usage(limit); }
  @Get("system-logs") logs(@Query("limit") limit?: number) { return this.admin.logs(limit); }
  @Get("security") security() { return this.admin.security(); }
  @Get("support/tickets") tickets(@CurrentUser() user: RequestUser) { return this.support.list("", user.id, true); }
  @Patch("support/tickets/:ticketId") updateTicket(@Param("ticketId") ticketId: string, @Body() dto: UpdateSupportTicketDto) { return this.support.update(ticketId, dto); }
  @Post("support/tickets/:ticketId/messages") reply(@Param("ticketId") ticketId: string, @Body() dto: AddSupportMessageDto, @CurrentUser() user: RequestUser) { return this.support.addMessage(ticketId, dto, user.id, true); }
}
