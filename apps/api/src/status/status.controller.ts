import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { CreateIncidentDto, IncidentUpdateDto, UpdatePlatformServiceDto } from "./dto/status.dto";
import { StatusService } from "./status.service";

@ApiTags("status")
@Controller({ path: "status", version: "1" })
export class PublicStatusController {
  constructor(private readonly status: StatusService) {}
  @Get() get() { return this.status.publicStatus(); }
}

@ApiTags("admin-status")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller({ path: "admin/status", version: "1" })
export class AdminStatusController {
  constructor(private readonly status: StatusService) {}
  @Get("services") services() { return this.status.services(); }
  @Patch("services/:serviceId") updateService(@Param("serviceId") serviceId: string, @Body() dto: UpdatePlatformServiceDto) { return this.status.updateService(serviceId, dto); }
  @Get("incidents") incidents() { return this.status.incidents(); }
  @Post("incidents") create(@Body() dto: CreateIncidentDto, @CurrentUser() user: RequestUser) { return this.status.createIncident(dto, user.id); }
  @Post("incidents/:incidentId/updates") update(@Param("incidentId") incidentId: string, @Body() dto: IncidentUpdateDto, @CurrentUser() user: RequestUser) { return this.status.addUpdate(incidentId, dto, user.id); }
  @Delete("incidents/:incidentId") remove(@Param("incidentId") incidentId: string) { return this.status.deleteIncident(incidentId); }
}
