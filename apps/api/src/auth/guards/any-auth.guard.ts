import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { hashApiKey } from "@clouddeploy/security";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Accepts EITHER a user JWT (`Authorization: Bearer <jwt>`) or a platform
 * API key (`Authorization: Bearer cd_<prefix>_<secret>`). API-key requests
 * are attributed to the key's creator (`request.user = { id: apiKey.userId
 * ... }`), so the existing RolesGuard's organization-membership check works
 * unmodified for both auth modes — an API key can only ever act within
 * organizations its creator actually belongs to.
 */
@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (token?.startsWith("cd_")) {
      return this.authenticateApiKey(request, token);
    }

    return this.jwtGuard.canActivate(context) as Promise<boolean>;
  }

  private async authenticateApiKey(request: any, token: string): Promise<boolean> {
    const keyHash = hashApiKey(token);
    const apiKey = await this.prisma.aPIKey.findFirst({
      where: { keyHash, revokedAt: null },
      include: { user: { select: { id: true, email: true, isPlatformAdmin: true, deletedAt: true, isSuspended: true } } },
    });

    if (!apiKey || !apiKey.user || apiKey.user.deletedAt || apiKey.user.isSuspended) {
      throw new UnauthorizedException("Invalid or revoked API key");
    }

    this.prisma.aPIKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

    request.user = { id: apiKey.user.id, email: apiKey.user.email, isPlatformAdmin: apiKey.user.isPlatformAdmin };
    request.apiKeyPermissions = apiKey.permissions;
    return true;
  }
}
