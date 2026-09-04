import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/** Pulls the caller's resolved OrgRole for this request (set by RolesGuard). */
export const CurrentOrgRole = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest();
  return request.organizationRole;
});
