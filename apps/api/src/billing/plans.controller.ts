import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("billing")
@Controller({ path: "plans", version: "1" })
export class PlansController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "List available plans (public)" })
  list() {
    return this.prisma.plan.findMany({ orderBy: { priceMonthlyCents: "asc" } });
  }
}
