import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { DomainsService } from "./domains.service";
import { CreateDomainDto } from "./dto/create-domain.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("domains")
@ApiBearerAuth()
@UseGuards(AnyAuthGuard, RolesGuard)
@Controller({ path: "domains", version: "1" })
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  @ApiOperation({ summary: "List domains in a workspace" })
  list(@Query("organizationId") organizationId: string) {
    return this.domainsService.list(organizationId);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Connect a custom domain and generate its DNS configuration" })
  create(@Query("organizationId") organizationId: string, @Body() dto: CreateDomainDto) {
    return this.domainsService.create(organizationId, dto);
  }

  @Get(":domainId")
  @ApiOperation({ summary: "Get domain + SSL status" })
  findOne(@Param("domainId") domainId: string) {
    return this.domainsService.findOne(domainId);
  }

  @Post(":domainId/verify")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.DEVELOPER)
  @ApiOperation({ summary: "Check DNS and issue SSL" })
  verify(@Param("domainId") domainId: string) {
    return this.domainsService.verify(domainId);
  }

  @Delete(":domainId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Remove a domain" })
  remove(@Param("domainId") domainId: string) {
    return this.domainsService.remove(domainId);
  }
}
