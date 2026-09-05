import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import crypto from "node:crypto";
import { encryptSecret, decryptSecretWithFallback } from "@clouddeploy/security";
import { RESOURCE_PRESETS } from "@clouddeploy/types";
import { PrismaService } from "../prisma/prisma.service";
import { RedisAdminService } from "./redis-admin.service";
import { CreateRedisDto } from "./dto/create-redis.dto";

@Injectable()
export class RedisDbService {
  private readonly logger = new Logger("RedisDbService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redisAdmin: RedisAdminService,
  ) {}

  async listByProject(projectId: string) {
    const rows = await this.prisma.redisInstance.findMany({
      where: { service: { projectId, deletedAt: null } },
      include: { service: { select: { id: true, name: true, status: true } } },
    });
    return rows.map((r) => this.withoutSecrets(r));
  }

  async create(dto: CreateRedisDto) {
    const preset = RESOURCE_PRESETS.find((p) => p.id === (dto.resourcePreset ?? "nano"))!;
    const username = `redis_${dto.name.replace(/-/g, "_")}`;
    const password = crypto.randomBytes(18).toString("base64url");
    const url = new URL(this.config.getOrThrow<string>("REDIS_URL"));
    const platformDomain = this.config.get<string>("PLATFORM_DOMAIN") ?? "clouddeploy.app";
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId }, select: { region: true } });
    if (!project) throw new NotFoundException("Project not found");

    const service = await this.prisma.service.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        type: "REDIS",
        runtime: "DOCKER",
        framework: "UNKNOWN",
        status: "QUEUED",
        rootDirectory: ".",
        cpuCores: preset.cpuCores,
        ramMb: preset.ramMb,
        internalHostname: `${dto.name}.internal`,
      },
    });

    const instance = await this.prisma.redisInstance.create({
      data: {
        serviceId: service.id,
        name: dto.name,
        status: "PROVISIONING",
        region: dto.region ?? project.region,
        host: `${dto.name}.${platformDomain}`,
        privateHost: `${dto.name}.internal`,
        port: Number(url.port || 6379),
        passwordCipher: encryptSecret(password, this.config.getOrThrow("ENCRYPTION_KEY")),
        ramMb: preset.ramMb,
        maxMemoryPolicy: dto.maxMemoryPolicy ?? "allkeys-lru",
      },
    });

    this.redisAdmin
      .createTenantUser(username, password)
      .then(async () => {
        await Promise.all([
          this.prisma.redisInstance.update({ where: { id: instance.id }, data: { status: "RUNNING" } }),
          this.prisma.service.update({ where: { id: service.id }, data: { status: "RUNNING" } }),
        ]);
        if (dto.attachToServiceId) {
          await this.attachToService(instance.id, dto.attachToServiceId);
        }
      })
      .catch(async (err) => {
        this.logger.error(`Failed to provision Redis ACL user "${username}": ${err.message}`);
        await this.prisma.redisInstance.update({ where: { id: instance.id }, data: { status: "FAILED" } });
        await this.prisma.service.update({ where: { id: service.id }, data: { status: "FAILED" } });
      });

    return { ...this.withoutSecrets(instance), username, initialPassword: password };
  }

  async getConnectionInfo(redisInstanceId: string) {
    const instance = await this.assertExists(redisInstanceId);
    const username = this.deriveUsername(instance.name);
    const password = decryptSecretWithFallback(instance.passwordCipher, this.config.getOrThrow("ENCRYPTION_KEY"), this.config.get("ENCRYPTION_KEY_PREVIOUS"));
    return {
      host: instance.privateHost,
      port: instance.port,
      username,
      password,
      keyPrefix: `${username}:`,
      connectionUrl: `redis://${username}:${password}@${instance.privateHost}:${instance.port}`,
      note: "This ACL user can only read/write keys under its own prefix — prefix every key with the keyPrefix shown above.",
    };
  }

  /** Writes REDIS_URL as an encrypted environment variable on the target service. */
  async attachToService(redisInstanceId: string, serviceId: string) {
    const instance = await this.assertExists(redisInstanceId);
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException("Service not found");

    const connection = await this.getConnectionInfo(redisInstanceId);
    const key = "REDIS_URL";
    const valueCipher = encryptSecret(connection.connectionUrl, this.config.getOrThrow("ENCRYPTION_KEY"));

    await this.prisma.environmentVariable.upsert({
      where: {
        projectId_serviceId_environment_key: {
          projectId: service.projectId,
          serviceId,
          environment: "PRODUCTION",
          key,
        } as never,
      },
      create: { projectId: service.projectId, serviceId, environment: "PRODUCTION", key, valueCipher, isSecret: true },
      update: { valueCipher },
    });

    return { attached: true, serviceId, key };
  }

  async getMetrics(redisInstanceId: string) {
    const instance = await this.assertExists(redisInstanceId);
    const username = this.deriveUsername(instance.name);
    return this.redisAdmin.getMetrics(username);
  }

  async restart(redisInstanceId: string) {
    await this.assertExists(redisInstanceId);
    await this.prisma.redisInstance.update({ where: { id: redisInstanceId }, data: { status: "RESTARTING" } });
    setTimeout(() => {
      this.prisma.redisInstance
        .update({ where: { id: redisInstanceId }, data: { status: "RUNNING" } })
        .catch(() => undefined);
    }, 1500);
    return { restarting: true };
  }

  async remove(redisInstanceId: string) {
    const instance = await this.assertExists(redisInstanceId);
    const username = this.deriveUsername(instance.name);
    await this.redisAdmin.deleteTenantUser(username);
    await this.prisma.service.update({ where: { id: instance.serviceId }, data: { deletedAt: new Date() } });
    return { removed: true };
  }

  private deriveUsername(name: string): string {
    return `redis_${name.replace(/-/g, "_")}`;
  }

  private withoutSecrets<T extends { passwordCipher?: string }>(row: T): Omit<T, "passwordCipher"> {
    const { passwordCipher, ...rest } = row;
    return rest;
  }

  private async assertExists(redisInstanceId: string) {
    const instance = await this.prisma.redisInstance.findUnique({ where: { id: redisInstanceId } });
    if (!instance) throw new NotFoundException("Redis instance not found");
    return instance;
  }
}
