import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { WebhooksService } from "./webhooks.service";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
import { OrgRole } from "@clouddeploy/database";

@ApiTags("webhooks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "webhooks", version: "1" })
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: "List webhooks for a workspace" })
  list(@Query("organizationId") organizationId: string) {
    return this.webhooksService.list(organizationId);
  }

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Create a webhook subscription" })
  create(@Body() dto: CreateWebhookDto, @CurrentUser() user: RequestUser) {
    return this.webhooksService.create(dto, user.id);
  }

  @Get(":webhookId/deliveries")
  @ApiOperation({ summary: "List recent delivery attempts" })
  deliveries(@Param("webhookId") webhookId: string) {
    return this.webhooksService.listDeliveries(webhookId);
  }

  @Delete(":webhookId")
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ApiOperation({ summary: "Delete a webhook" })
  remove(@Param("webhookId") webhookId: string) {
    return this.webhooksService.remove(webhookId);
  }
}
