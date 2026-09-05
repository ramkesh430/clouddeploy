import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthTokens } from "@clouddeploy/types";
import { AnyAuthGuard } from "./guards/any-auth.guard";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";

const REFRESH_COOKIE = "cd_refresh_token";

@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Create a new account" })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(res, result.tokens);
    return { user: result.user, accessToken: result.tokens.accessToken, expiresIn: result.tokens.expiresIn };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Login with email and password" })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    this.setRefreshCookie(res, result.tokens);
    return { user: result.user, accessToken: result.tokens.accessToken, expiresIn: result.tokens.expiresIn };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Exchange a refresh token for a new access token" })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (!refreshToken) throw new UnauthorizedException("Missing refresh token");
    const result = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, result.tokens);
    return { user: result.user, accessToken: result.tokens.accessToken, expiresIn: result.tokens.expiresIn };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke the current refresh token" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (refreshToken) await this.authService.logout(refreshToken);
    res.clearCookie(REFRESH_COOKIE);
    return { loggedOut: true };
  }

  @Get("me")
  @UseGuards(AnyAuthGuard)
  @ApiOperation({ summary: "Return the authenticated user/API-key principal and workspaces" })
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user.id);
  }

  @Get("verify-email")
  @ApiOperation({ summary: "Verify an email address from the emailed token" })
  async verifyEmail(@Query("token") token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Request a password reset email" })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password using a reset token" })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  private setRefreshCookie(res: Response, tokens: AuthTokens) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
