import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface RequestUser {
  id: string;
  email: string;
  isPlatformAdmin?: boolean;
  twoFactorEnabled?: boolean;
}

/** Pulls the authenticated user (attached by JwtAuthGuard) off the request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
