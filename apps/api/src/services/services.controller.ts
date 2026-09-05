import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { ServicesService } from "./services.service";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("services")
@ApiBearerAuth()
@UseGuards(AnyAuthGuard, RolesGuard)
@Controller({ path: "services", version: "1" })
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: "List services for a project" })
  list(@Query("projectId") projectId: string) {
    return this.servicesService.listByProject(projectId);
  }

  @Get("workers")
  @ApiOperation({ summary: "List WORKER-type services for a project — background processes with no public URL" })
  listWorkers(@Query("projectId") projectId: string) {
    return this.servicesService.listWorkers(projectId);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Add a service to a project" })
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Get(":serviceId")
  @ApiOperation({ summary: "Get service details" })
  findOne(@Param("serviceId") serviceId: string) {
    return this.servicesService.findOne(serviceId);
  }

  @Patch(":serviceId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Update service configuration" })
  update(@Param("serviceId") serviceId: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(serviceId, dto);
  }

  @Post(":serviceId/restart")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Restart a service" })
  restart(@Param("serviceId") serviceId: string) {
    return this.servicesService.restart(serviceId);
  }

  @Delete(":serviceId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Remove a service" })
  remove(@Param("serviceId") serviceId: string) {
    return this.servicesService.remove(serviceId);
  }
}
