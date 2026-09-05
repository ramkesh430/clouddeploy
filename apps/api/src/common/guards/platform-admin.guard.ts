import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    if (!user?.isPlatformAdmin) throw new ForbiddenException("Platform administrator access required");
    return true;
  }
}
