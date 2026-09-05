import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { AbuseService } from "./abuse.service";
import { ApplyAbuseActionDto, CreateAbuseReportDto, CreateRiskEventDto } from "./dto/abuse.dto";

@ApiTags("abuse")
@ApiBearerAuth()
@Controller({ path: "abuse", version: "1" })
export class AbuseController {
  constructor(private readonly abuse: AbuseService) {}
  @Post("reports") @UseGuards(AnyAuthGuard, RolesGuard) report(@Body() dto: CreateAbuseReportDto, @CurrentUser() user: RequestUser) { return this.abuse.createReport(dto, user.id); }
}

@ApiTags("admin-abuse")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller({ path: "admin/abuse", version: "1" })
export class AdminAbuseController {
  constructor(private readonly abuse: AbuseService) {}
  @Get("reports") reports(@Query("status") status?: string) { return this.abuse.reports(status); }
  @Get("risk-events") events(@Query("status") status?: string) { return this.abuse.events(status); }
  @Post("risk-events") create(@Body() dto: CreateRiskEventDto) { return this.abuse.createRiskEvent(dto); }
  @Post("risk-events/:eventId/actions") action(@Param("eventId") eventId: string, @Body() dto: ApplyAbuseActionDto, @CurrentUser() user: RequestUser) { return this.abuse.applyAction(eventId, dto, user.id); }
}
