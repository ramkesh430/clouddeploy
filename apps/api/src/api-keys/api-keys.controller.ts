import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { ApiKeysService } from "./api-keys.service";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("api-keys")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "api-keys", version: "1" })
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: "List API keys (values masked — only the prefix is shown)" })
  list(@Query("organizationId") organizationId: string) {
    return this.apiKeysService.list(organizationId);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Create an API key — the full key is only ever returned in this response" })
  create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: RequestUser) {
    return this.apiKeysService.create(dto, user.id);
  }

  @Delete(":apiKeyId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Revoke an API key" })
  revoke(@Param("apiKeyId") apiKeyId: string) {
    return this.apiKeysService.revoke(apiKeyId);
  }
}
