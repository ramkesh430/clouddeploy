import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { NotificationsService } from "./notifications.service";
import { SetPreferenceDto } from "./dto/set-preference.dto";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: "notifications", version: "1" })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List notifications for the current user" })
  list(@CurrentUser() user: RequestUser) {
    return this.notificationsService.list(user.id);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Count unread notifications" })
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationsService.unreadCount(user.id);
  }

  @Post(":notificationId/read")
  @ApiOperation({ summary: "Mark one notification read" })
  markRead(@Param("notificationId") notificationId: string) {
    return this.notificationsService.markRead(notificationId);
  }

  @Post("read-all")
  @ApiOperation({ summary: "Mark all notifications read" })
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get("preferences")
  @ApiOperation({ summary: "List notification preferences" })
  listPreferences(@CurrentUser() user: RequestUser) {
    return this.notificationsService.listPreferences(user.id);
  }

  @Post("preferences")
  @ApiOperation({ summary: "Set a notification preference" })
  setPreference(@CurrentUser() user: RequestUser, @Body() dto: SetPreferenceDto) {
    return this.notificationsService.setPreference(user.id, dto.type, dto.channel, dto.enabled);
  }
}
