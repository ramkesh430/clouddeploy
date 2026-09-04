import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("metrics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "services/:serviceId/metric-rollups", version: "1" })
export class MetricsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Downsampled CPU/RAM history for a service (hourly or daily buckets)" })
  list(@Param("serviceId") serviceId: string, @Query("period") period: "HOURLY" | "DAILY" = "HOURLY") {
    return this.prisma.metricRollup.findMany({
      where: { serviceId, period },
      orderBy: { periodStart: "desc" },
      take: 500,
    });
  }
}
