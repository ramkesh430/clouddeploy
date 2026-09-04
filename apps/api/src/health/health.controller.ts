import { Controller, Get, HttpException, HttpStatus, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";

// Health checks are hit by infra/load balancers without version concerns, so
// this controller opts out of URI versioning and the global "api" prefix
// (see main.ts) to stay at clean /health, /health/database, etc. paths.
@ApiTags("health")
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  private redisClient: Redis | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getRedis(): Redis {
    if (!this.redisClient) {
      this.redisClient = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
    }
    return this.redisClient;
  }

  @Get()
  overall() {
    return { status: "ok", service: "clouddeploy-api", timestamp: new Date().toISOString() };
  }

  @Get("database")
  async database() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", component: "database" };
    } catch (err) {
      throw new HttpException(
        { status: "error", component: "database", message: (err as Error).message },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get("redis")
  async redis() {
    try {
      const client = this.getRedis();
      await client.connect().catch(() => undefined);
      const pong = await client.ping();
      return { status: pong === "PONG" ? "ok" : "degraded", component: "redis" };
    } catch (err) {
      throw new HttpException(
        { status: "error", component: "redis", message: (err as Error).message },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get("storage")
  async storage() {
    // S3/MinIO connectivity is verified by the storage package adapter in
    // Phase 2; until then this endpoint reports configuration presence.
    const configured = Boolean(process.env.S3_ENDPOINT);
    return { status: configured ? "ok" : "unconfigured", component: "storage" };
  }

  @Get("queue")
  async queue() {
    try {
      const client = this.getRedis();
      await client.connect().catch(() => undefined);
      await client.ping();
      return { status: "ok", component: "queue" };
    } catch (err) {
      throw new HttpException(
        { status: "error", component: "queue", message: (err as Error).message },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
