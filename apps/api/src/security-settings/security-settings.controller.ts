import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { VerifyTwoFactorDto } from "./dto/security-settings.dto";
import { SecuritySettingsService } from "./security-settings.service";

@ApiTags("security")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: "security", version: "1" })
export class SecuritySettingsController {
  constructor(private readonly security: SecuritySettingsService) {}
  @Get() overview(@CurrentUser() user: RequestUser) { return this.security.overview(user.id); }
  @Post("2fa/setup") setup(@CurrentUser() user: RequestUser) { return this.security.beginTwoFactor(user.id, user.email); }
  @Post("2fa/enable") enable(@CurrentUser() user: RequestUser, @Body() dto: VerifyTwoFactorDto) { return this.security.enableTwoFactor(user.id, dto.code); }
  @Post("2fa/disable") disable(@CurrentUser() user: RequestUser, @Body() dto: VerifyTwoFactorDto) { return this.security.disableTwoFactor(user.id, dto.code); }
  @Post("sessions/revoke-others") revoke(@CurrentUser() user: RequestUser, @Req() req: Request) { return this.security.revokeOtherSessions(user.id, req.cookies?.cd_refresh_token); }
}
