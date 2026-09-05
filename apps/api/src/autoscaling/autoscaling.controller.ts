import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OrgRole } from "@clouddeploy/database";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { AutoscalingService } from "./autoscaling.service";
import { UpsertAutoscalingPolicyDto } from "./dto/autoscaling.dto";

@ApiTags("autoscaling")
@ApiBearerAuth()
@UseGuards(AnyAuthGuard, RolesGuard)
@Controller({ path: "autoscaling", version: "1" })
export class AutoscalingController {
  constructor(private readonly autoscaling: AutoscalingService) {}
  @Get(":serviceId") get(@Param("serviceId") serviceId: string) { return this.autoscaling.get(serviceId); }
  @Put(":serviceId") @Roles(OrgRole.OWNER, OrgRole.ADMIN) upsert(@Param("serviceId") serviceId: string, @Body() dto: UpsertAutoscalingPolicyDto) { return this.autoscaling.upsert({ ...dto, serviceId }); }
  @Post(":serviceId/evaluate") @Roles(OrgRole.OWNER, OrgRole.ADMIN) evaluate(@Param("serviceId") serviceId: string) { return this.autoscaling.evaluate(serviceId); }
}
