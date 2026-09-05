import { Injectable, NotFoundException } from "@nestjs/common";
import crypto from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { ServicesService } from "../services/services.service";
import { DatabasesService } from "../databases/databases.service";
import { RedisDbService } from "../redis-db/redis-db.service";
import { EnvironmentVariablesService } from "../environment-variables/environment-variables.service";
import { DeploymentsService } from "../deployments/deployments.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { StorageService } from "../storage/storage.service";
import { DeployTemplateDto } from "./dto/deploy-template.dto";
import { TemplateDefinition } from "./template-definition";

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly services: ServicesService,
    private readonly databases: DatabasesService,
    private readonly redis: RedisDbService,
    private readonly envVars: EnvironmentVariablesService,
    private readonly deployments: DeploymentsService,
    private readonly activityLog: ActivityLogService,
    private readonly storage: StorageService,
  ) {}

  async listCategories() {
    return this.prisma.templateCategory.findMany({ orderBy: { name: "asc" } });
  }

  /** organizationId is optional so the marketplace (platform templates,
   * organizationId: null) is browsable before a workspace is even picked;
   * passing one also includes that org's own private templates. */
  async list(organizationId?: string) {
    return this.prisma.template.findMany({
      where: { OR: [{ organizationId: null }, ...(organizationId ? [{ organizationId }] : [])] },
      include: { category: true },
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    });
  }

  async findOne(templateId: string) {
    const template = await this.prisma.template.findUnique({ where: { id: templateId }, include: { category: true } });
    if (!template) throw new NotFoundException("Template not found");
    return template;
  }

  /** One-click deploy: provisions a real project + service, real managed
   * database/Redis when the template needs them (reusing the same
   * provisioning code path as creating them by hand), real generated
   * secrets for the template's required env vars, and queues a real
   * deployment that reuses the template's known public image — skipping
   * the build steps the same way a rollback does, since there's no source
   * to clone or build for a pre-built image. */
  async deploy(templateId: string, dto: DeployTemplateDto, userId: string) {
    const template = await this.findOne(templateId);
    const def = template.servicesJson as unknown as TemplateDefinition;
    const slug = dto.projectSlug ?? this.slugify(dto.projectName);

    const project = await this.projects.create(dto.organizationId, userId, {
      organizationId: dto.organizationId,
      name: dto.projectName,
      slug,
      description: `Deployed from the ${template.name} template`,
      region: dto.region,
    });

    const definitions = def.services ?? (def.service ? [def.service] : []);
    if (!definitions.length) throw new NotFoundException("Template contains no service definitions");
    const createdServices = [];
    for (const definition of definitions) {
      createdServices.push(await this.services.create({
        projectId: project.id,
        name: definition.name,
        type: definition.type ?? (definition.dockerImage ? "DOCKER_SERVICE" : "WEB_SERVICE"),
        runtime: definition.runtime ?? (definition.dockerImage ? "DOCKER" : "NODE"),
        framework: definition.framework ?? "UNKNOWN",
        rootDirectory: definition.rootDirectory,
        buildCommand: definition.buildCommand,
        startCommand: definition.startCommand,
        port: definition.port,
        healthCheckPath: definition.healthCheckPath,
        resourcePreset: def.resourcePreset ?? "starter",
      }));
    }
    const service = createdServices.find((item) => item.name === def.databaseTargetService) ?? createdServices[0]!;

    if (def.needsDatabase) {
      const database = await this.databases.create({
        organizationId: dto.organizationId,
        name: `${slug}-db`,
        engine: def.databaseEngine ?? "POSTGRESQL",
        region: project.region,
        resourcePreset: def.resourcePreset ?? "starter",
      });
      const conn = await this.databases.getConnectionInfo(database.id);
      const mapping = def.databaseEnvVars ?? { connectionUrl: "DATABASE_URL" };
      const writes: [string, string][] = [
        [mapping.host!, conn.privateHost],
        [mapping.port!, String(conn.port)],
        [mapping.database!, conn.database],
        [mapping.username!, conn.username],
        [mapping.password!, conn.password],
        [mapping.connectionUrl!, conn.connectionUrl],
      ].filter(([key]) => !!key) as [string, string][];
      for (const [key, value] of writes) {
        await this.envVars.create({ projectId: project.id, serviceId: service.id, key, value, isSecret: true }, userId);
      }
    }

    if (def.needsRedis) {
      const redisTarget = createdServices.find((item) => item.name === def.redisTargetService) ?? service;
      await this.redis.create({
        projectId: project.id,
        name: `${slug}-cache`,
        resourcePreset: def.resourcePreset ?? "nano",
        attachToServiceId: redisTarget.id,
        region: project.region,
      });
    }

    for (const bucket of def.storage ?? []) {
      await this.storage.createBucket({ organizationId: dto.organizationId, name: `${slug}-${bucket.name}`.slice(0, 62), isPublic: bucket.isPublic, region: project.region });
    }

    for (const [key, value] of Object.entries(def.staticEnvVars ?? {})) {
      await this.envVars.create({ projectId: project.id, serviceId: service.id, key, value, isSecret: false }, userId);
    }

    // Values for secret-shaped keys (SECRET/KEY/PASSWORD/TOKEN/SALT) are
    // real generated random secrets, safe to use as-is. Anything else
    // (e.g. WordPress's WORDPRESS_DB_HOST, which must point at a real
    // external database this platform doesn't provision) gets an obvious
    // placeholder the user has to replace before the service will work —
    // dishonest to fake a working value for those.
    const SECRET_SHAPED = /SECRET|KEY|PASSWORD|TOKEN|SALT|ENCRYPTION/i;
    for (const key of template.requiredEnvVars) {
      const value = SECRET_SHAPED.test(key) ? crypto.randomBytes(24).toString("hex") : "REPLACE_ME";
      await this.envVars.create({ projectId: project.id, serviceId: service.id, key, value, isSecret: true }, userId);
    }

    const deployments = [];
    for (let index = 0; index < createdServices.length; index += 1) {
      const currentService = createdServices[index]!;
      const definition = definitions[index]!;
      deployments.push(await this.deployments.create(
        { projectId: project.id, serviceId: currentService.id },
        userId,
        false,
        { sha: `template:${template.slug}`, message: `Deployed from template: ${template.name}` },
        definition.dockerImage ? { dockerImageTag: definition.dockerImage, registryPath: null } : undefined,
      ));
    }
    const deployment = deployments[0]!;

    await this.activityLog.log({
      organizationId: dto.organizationId,
      projectId: project.id,
      userId,
      action: "template.deployed",
      resourceType: "Template",
      resourceId: template.id,
    });

    return { project, service, services: createdServices, deployment, deployments };
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }
}
