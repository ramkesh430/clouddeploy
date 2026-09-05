import { CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
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
  private readonly logger = new Logger("AnyAuthGuard");
  private redisClient: Redis | null = null;

  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
      include: { user: { select: { id: true, email: true, isPlatformAdmin: true, deletedAt: true, isSuspended: true } }, organization: { include: { subscription: { include: { plan: true } } } } },
    });

    if (!apiKey || !apiKey.user || apiKey.user.deletedAt || apiKey.user.isSuspended) {
      throw new UnauthorizedException("Invalid or revoked API key");
    }

    const clientIp = this.normalizeIp(request.ip ?? request.socket?.remoteAddress ?? "");
    if (apiKey.allowedIpRanges.length && !apiKey.allowedIpRanges.some((range) => this.ipMatches(clientIp, range))) {
      throw new ForbiddenException("API key is not allowed from this IP address");
    }

    const permission = this.requiredPermission(request.method, request.path ?? request.url);
    if (permission && !apiKey.permissions.includes(permission) && !apiKey.permissions.includes("*")) {
      throw new ForbiddenException(`API key requires ${permission}`);
    }

    const planTier = apiKey.organization.subscription?.plan.tier ?? "FREE";
    const planLimit = ({ FREE: 60, DEVELOPER: 120, PRO: 300, BUSINESS: 1_000, ENTERPRISE: 5_000 } as const)[planTier];
    await this.consumeRateLimit(apiKey.id, Math.min(apiKey.rateLimitPerMinute ?? planLimit, planLimit));

    this.prisma.aPIKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

    request.user = { id: apiKey.user.id, email: apiKey.user.email, isPlatformAdmin: apiKey.user.isPlatformAdmin };
    request.apiKeyPermissions = apiKey.permissions;
    request.apiKeyId = apiKey.id;
    return true;
  }

  private requiredPermission(method: string, path: string): string | null {
    const write = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
    if (/\/deployment[^/]*\/[^/]+\/logs/.test(path)) return "logs:read";
    if (/\/deployments/.test(path)) return `deployments:${write ? "write" : "read"}`;
    if (/\/projects/.test(path)) return `projects:${write ? "write" : "read"}`;
    if (/\/services/.test(path)) return `services:${write ? "write" : "read"}`;
    if (/\/environment-variables/.test(path)) return `environment:${write ? "write" : "read"}`;
    if (/\/databases/.test(path)) return `databases:${write ? "write" : "read"}`;
    if (/\/domains/.test(path)) return `domains:${write ? "write" : "read"}`;
    if (/\/ai/.test(path)) return "ai:write";
    return null;
  }

  private getRedisClient(): Redis {
    if (!this.redisClient) {
      this.redisClient = new Redis(this.config.getOrThrow<string>("REDIS_URL"));
    }
    return this.redisClient;
  }

  /** Fixed-window counter in Redis, shared across every API process — the
   * in-memory Map this replaced reset per-process, so a client could get up
   * to N requests per instance behind a load balancer instead of N total,
   * and every limit reset on deploy/restart. INCR-then-conditionally-EXPIRE
   * is Redis's own documented rate-limiting pattern: the tiny race between
   * the two commands can at worst leave one key with a slightly-off TTL,
   * never an incorrect count. Fails open (logs and allows the request) if
   * Redis is unreachable, since a rate limiter outage shouldn't take down
   * the API — this is defense-in-depth, not the primary authorization gate. */
  private async consumeRateLimit(keyId: string, limit: number): Promise<void> {
    const key = `ratelimit:apikey:${keyId}`;
    let count: number;
    try {
      const client = this.getRedisClient();
      count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, 60);
      }
    } catch (err) {
      this.logger.warn(`Rate limiter unavailable, allowing request: ${(err as Error).message}`);
      return;
    }
    if (count > limit) {
      throw new HttpException("API key rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private normalizeIp(value: string) { return value.replace(/^::ffff:/, ""); }

  private ipMatches(ip: string, rule: string) {
    if (!rule.includes("/")) return ip === this.normalizeIp(rule);
    const [network, prefixText] = rule.split("/");
    const prefix = Number(prefixText);
    const ipNumber = this.ipv4Number(ip);
    const networkNumber = this.ipv4Number(network!);
    if (ipNumber == null || networkNumber == null || prefix < 0 || prefix > 32) return false;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ipNumber & mask) === (networkNumber & mask);
  }

  private ipv4Number(value: string) {
    const parts = value.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    return (((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!) >>> 0;
  }
}
