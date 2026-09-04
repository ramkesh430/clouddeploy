import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AlertsService } from "./alerts.service";
import { CreateAlertRuleDto } from "./dto/create-alert-rule.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("alerts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "alerts", version: "1" })
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: "List alert rules for a workspace" })
  list(@Query("organizationId") organizationId: string) {
    return this.alertsService.list(organizationId);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Create a threshold alert rule" })
  create(@Body() dto: CreateAlertRuleDto) {
    return this.alertsService.create(dto);
  }

  @Post(":alertRuleId/enable")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Enable an alert rule" })
  enable(@Param("alertRuleId") alertRuleId: string) {
    return this.alertsService.setEnabled(alertRuleId, true);
  }

  @Post(":alertRuleId/disable")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Disable an alert rule" })
  disable(@Param("alertRuleId") alertRuleId: string) {
    return this.alertsService.setEnabled(alertRuleId, false);
  }

  @Delete(":alertRuleId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Delete an alert rule" })
  remove(@Param("alertRuleId") alertRuleId: string) {
    return this.alertsService.remove(alertRuleId);
  }
}
