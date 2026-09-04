import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RedisDbService } from "./redis-db.service";
import { CreateRedisDto } from "./dto/create-redis.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("redis")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "redis", version: "1" })
export class RedisDbController {
  constructor(private readonly redisDbService: RedisDbService) {}

  @Get()
  @ApiOperation({ summary: "List Redis instances for a project" })
  list(@Query("projectId") projectId: string) {
    return this.redisDbService.listByProject(projectId);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Provision a Redis instance" })
  create(@Body() dto: CreateRedisDto) {
    return this.redisDbService.create(dto);
  }

  @Get(":redisInstanceId/connection")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Get Redis connection credentials" })
  connection(@Param("redisInstanceId") redisInstanceId: string) {
    return this.redisDbService.getConnectionInfo(redisInstanceId);
  }

  @Post(":redisInstanceId/attach")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Inject REDIS_URL into a service's environment variables" })
  attach(@Param("redisInstanceId") redisInstanceId: string, @Body("serviceId") serviceId: string) {
    return this.redisDbService.attachToService(redisInstanceId, serviceId);
  }

  @Get(":redisInstanceId/metrics")
  @ApiOperation({ summary: "Real live metrics: key count under this tenant's prefix + server memory usage" })
  metrics(@Param("redisInstanceId") redisInstanceId: string) {
    return this.redisDbService.getMetrics(redisInstanceId);
  }

  @Post(":redisInstanceId/restart")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Restart a Redis instance" })
  restart(@Param("redisInstanceId") redisInstanceId: string) {
    return this.redisDbService.restart(redisInstanceId);
  }

  @Delete(":redisInstanceId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Remove a Redis instance" })
  remove(@Param("redisInstanceId") redisInstanceId: string) {
    return this.redisDbService.remove(redisInstanceId);
  }
}
