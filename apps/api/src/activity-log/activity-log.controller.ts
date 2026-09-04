import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ActivityLogService } from "./activity-log.service";

@ApiTags("activity-log")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "organizations/:organizationId/activity-logs", version: "1" })
export class ActivityLogController {
  constructor(private readonly activityLog: ActivityLogService) {}

  @Get()
  @ApiOperation({ summary: "Audit trail of account/security-relevant actions for a workspace" })
  list(@Param("organizationId") organizationId: string) {
    return this.activityLog.list(organizationId);
  }
}
