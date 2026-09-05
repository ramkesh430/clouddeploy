import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { NodeRole } from "@clouddeploy/database";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { CompleteServerCommandDto, CreateRegionDto, RegisterServerDto, ServerActionDto, ServerHeartbeatDto } from "./dto/infrastructure.dto";
import { InfrastructureService } from "./infrastructure.service";

@ApiTags("regions")
@Controller({ path: "regions", version: "1" })
export class RegionsController {
  constructor(private readonly infrastructure: InfrastructureService) {}
  @Get() list() { return this.infrastructure.regions(false); }
  @ApiBearerAuth()
  @UseGuards(AnyAuthGuard, RolesGuard)
  @Get("project/:projectId/warnings") warnings(@Param("projectId") projectId: string, @Query("region") region?: string) { return this.infrastructure.dependencyWarnings(projectId, region); }
}

@ApiTags("server-agents")
@Controller({ path: "server-agent", version: "1" })
export class ServerAgentController {
  constructor(private readonly infrastructure: InfrastructureService) {}
  @Post("heartbeat") heartbeat(@Headers("x-agent-token") token: string | undefined, @Body() dto: ServerHeartbeatDto) { return this.infrastructure.heartbeat(token, dto); }
  @Get("commands") commands(@Headers("x-agent-token") token: string | undefined) { return this.infrastructure.pollCommands(token); }
  @Post("commands/:commandId/complete") complete(@Headers("x-agent-token") token: string | undefined, @Param("commandId") commandId: string, @Body() dto: CompleteServerCommandDto) { return this.infrastructure.completeCommand(token, commandId, dto); }
}

@ApiTags("admin-infrastructure")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller({ path: "admin/infrastructure", version: "1" })
export class AdminInfrastructureController {
  constructor(private readonly infrastructure: InfrastructureService) {}
  @Get("regions") regions() { return this.infrastructure.regions(true); }
  @Post("regions") createRegion(@Body() dto: CreateRegionDto) { return this.infrastructure.createRegion(dto); }
  @Patch("regions/:regionId") updateRegion(@Param("regionId") regionId: string, @Body() dto: Partial<CreateRegionDto> & { active?: boolean }) { return this.infrastructure.updateRegion(regionId, dto); }
  @Get("servers") servers(@Query("role") role?: NodeRole) { return this.infrastructure.servers(role); }
  @Post("servers") register(@Body() dto: RegisterServerDto) { return this.infrastructure.registerServer(dto); }
  @Post("servers/:serverId/actions") action(@Param("serverId") serverId: string, @Body() dto: ServerActionDto) { return this.infrastructure.action(serverId, dto); }
  @Get("capacity") capacity() { return this.infrastructure.capacity(); }
}
