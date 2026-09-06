import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.isPlatformAdmin) throw new ForbiddenException("Platform administrator access required");
    // Reads stay open so an admin without 2FA can still see the dashboard and
    // find their way to the security page — only mutations are gated, so
    // this can't lock an admin out of enabling 2FA in the first place.
    if (request.method !== "GET" && !user.twoFactorEnabled) {
      throw new ForbiddenException("Enable two-factor authentication before performing administrative actions");
    }
    return true;
  }
}
