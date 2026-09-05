import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AnyAuthGuard } from "../auth/guards/any-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { AddSupportMessageDto, CreateSupportTicketDto } from "./dto/support.dto";
import { SupportService } from "./support.service";

@ApiTags("support")
@ApiBearerAuth()
@UseGuards(AnyAuthGuard, RolesGuard)
@Controller({ path: "support", version: "1" })
export class SupportController {
  constructor(private readonly support: SupportService) {}
  @Get("tickets") list(@Query("organizationId") organizationId: string, @CurrentUser() user: RequestUser) { return this.support.list(organizationId, user.id); }
  @Post("tickets") create(@Body() dto: CreateSupportTicketDto, @CurrentUser() user: RequestUser) { return this.support.create(dto, user.id); }
  @Get("tickets/:ticketId") detail(@Param("ticketId") ticketId: string) { return this.support.detail(ticketId); }
  @Post("tickets/:ticketId/messages") message(@Param("ticketId") ticketId: string, @Body() dto: AddSupportMessageDto, @CurrentUser() user: RequestUser) { return this.support.addMessage(ticketId, dto, user.id); }
}
