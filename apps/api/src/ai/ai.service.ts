import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@clouddeploy/database";
import { detectRepositoryStack } from "@clouddeploy/deployment-core";
import type {
  DockerfileGenerationResult,
  LogAnalysisResult,
  RepositoryAnalysisResult,
  ResourceRecommendation,
} from "@clouddeploy/types";
import { PrismaService } from "../prisma/prisma.service";
import { EnvironmentVariablesService } from "../environment-variables/environment-variables.service";
import { ServicesService } from "../services/services.service";
import { DeploymentsService } from "../deployments/deployments.service";
import { DatabasesService } from "../databases/databases.service";
import {
  AnalyzeLogsDto,
  AnalyzeRepositoryDto,
  ApplyFixDto,
  GenerateDockerfileDto,
  RecommendResourcesDto,
} from "./dto/ai-analysis.dto";
import { isSensitiveRepositoryPath, redactSecrets } from "./secret-redactor";

type JsonObject = Record<string, unknown>;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly envVars: EnvironmentVariablesService,
    private readonly services: ServicesService,
    private readonly deployments: DeploymentsService,
    private readonly databases: DatabasesService,
  ) {}

  async analyzeRepository(dto: AnalyzeRepositoryDto, userId: string) {
    const sanitized = this.sanitizeFiles(dto.files);
    const detection = detectRepositoryStack({
      repositoryFullName: dto.repositoryFullName,
      defaultBranch: dto.defaultBranch ?? "main",
      allPaths: sanitized.files.map((file) => file.path),
      manifestContents: Object.fromEntries(
        sanitized.files.filter((file) => file.content !== undefined).map((file) => [file.path, file.content!]),
      ),
    });

    const searchable = sanitized.files.map((file) => `${file.path}\n${file.content ?? ""}`).join("\n").toLowerCase();
    const storageRequired = /(@aws-sdk\/client-s3|aws-sdk|cloudinary|multer|upload|storage\/app|media_root)/.test(searchable);
    const envSuggestions = this.environmentSuggestions(sanitized.files, detection);
    const resources = this.recommendForSignals(detection.services.map((service) => service.framework), 0, 0, !!detection.database, !!detection.redis);

    const components: RepositoryAnalysisResult["architecture"]["components"] = detection.services.map((service, index) => ({
      id: `service-${index}`,
      label: service.name,
      kind: service.type,
      regionAffinity: "project",
    }));
    if (detection.database) components.push({ id: "database", label: detection.database.engine, kind: "DATABASE", regionAffinity: "same-region-required" });
    if (detection.redis) components.push({ id: "redis", label: "Redis", kind: "CACHE", regionAffinity: "same-region-required" });
    if (storageRequired) components.push({ id: "storage", label: "Object Storage", kind: "STORAGE", regionAffinity: "same-region-preferred" });

    const result: RepositoryAnalysisResult = {
      services: detection.services.map((service) => ({ ...service, type: String(service.type), runtime: String(service.runtime), framework: String(service.framework) })),
      runtime: [...new Set(detection.services.map((service) => String(service.runtime)))],
      framework: [...new Set(detection.services.map((service) => String(service.framework)))],
      buildCommand: detection.services.flatMap((service) => (service.buildCommand ? [service.buildCommand] : [])),
      startCommand: detection.services.flatMap((service) => (service.startCommand ? [service.startCommand] : [])),
      port: detection.services.flatMap((service) => (service.port ? [service.port] : [])),
      databaseNeeds: detection.database ? { required: true, engine: detection.database.engine, reason: detection.database.reason } : { required: false },
      redisNeeds: detection.redis ? { required: true, reason: detection.redis.reason } : { required: false },
      storageNeeds: storageRequired ? { required: true, reason: "Repository contains upload or object-storage dependencies." } : { required: false },
      environmentVariableSuggestions: envSuggestions,
      resourceRecommendations: resources,
      architecture: {
        summary: this.architectureSummary(detection.services.length, !!detection.database, !!detection.redis, storageRequired),
        components,
        connections: this.architectureConnections(detection.services.length, !!detection.database, !!detection.redis, storageRequired),
      },
      warnings: [
        ...(detection.services.length === 0 ? ["No supported runtime manifest was found. Generate and review a Dockerfile before deploying."] : []),
        ...(detection.services.some((service) => service.confidence < 0.7) ? ["At least one service has low-confidence runtime detection; review commands and port."] : []),
        ...(sanitized.omittedPaths.length ? [`${sanitized.omittedPaths.length} sensitive file(s) were excluded from analysis.`] : []),
      ],
    };

    return this.prisma.aIAnalysis.create({
      data: {
        organizationId: dto.organizationId,
        projectId: dto.projectId,
        createdById: userId,
        type: "REPOSITORY",
        inputMetadata: { repositoryFullName: dto.repositoryFullName, defaultBranch: dto.defaultBranch ?? "main", filePaths: sanitized.files.map((file) => file.path), omittedPaths: sanitized.omittedPaths },
        result: result as unknown as Prisma.InputJsonValue,
        secretsRedacted: sanitized.redactedCount,
      },
      include: { proposals: true },
    });
  }

  async analyzeLogs(dto: AnalyzeLogsDto, userId: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: dto.deploymentId },
      include: { project: true, service: true, logs: { orderBy: { timestamp: "asc" }, take: 2_000 } },
    });
    if (!deployment || deployment.project.organizationId !== dto.organizationId) throw new NotFoundException("Deployment not found");

    const raw = dto.logs ?? deployment.logs.map((entry) => `[${entry.level}] ${entry.message}`).join("\n");
    const redacted = redactSecrets(raw.slice(-500_000));
    const result = this.diagnoseLogs(redacted.value, deployment.service?.id ?? null, deployment.service?.name ?? null, deployment.projectId);

    return this.prisma.$transaction(async (tx) => {
      const analysis = await tx.aIAnalysis.create({
        data: {
          organizationId: dto.organizationId,
          projectId: deployment.projectId,
          deploymentId: deployment.id,
          createdById: userId,
          type: "DEPLOYMENT_LOGS",
          inputMetadata: { deploymentId: deployment.id, lineCount: redacted.value.split("\n").length },
          result: result as unknown as Prisma.InputJsonValue,
          secretsRedacted: redacted.redactedCount,
        },
      });
      if (result.actions.length) {
        await tx.aIFixProposal.createMany({
          data: result.actions.map((action) => ({
            analysisId: analysis.id,
            actionType: action.type,
            title: action.title,
            explanation: action.explanation,
            payload: action.payload as Prisma.InputJsonValue,
            isSensitive: true,
          })),
        });
      }
      return tx.aIAnalysis.findUnique({ where: { id: analysis.id }, include: { proposals: true } });
    });
  }

  async generateDockerfile(dto: GenerateDockerfileDto, userId: string) {
    const sanitized = this.sanitizeFiles(dto.files);
    const detection = detectRepositoryStack({
      repositoryFullName: dto.repositoryFullName,
      defaultBranch: dto.defaultBranch ?? "main",
      allPaths: sanitized.files.map((file) => file.path),
      manifestContents: Object.fromEntries(sanitized.files.filter((file) => file.content).map((file) => [file.path, file.content!])),
    });
    const service = detection.services.find((item) => !dto.serviceName || item.name === dto.serviceName) ?? detection.services[0];
    const result = this.buildDockerfile(service?.runtime ? String(service.runtime) : this.inferRuntime(sanitized.files), service);

    return this.prisma.aIAnalysis.create({
      data: {
        organizationId: dto.organizationId,
        projectId: dto.projectId,
        createdById: userId,
        type: "DOCKERFILE",
        inputMetadata: { repositoryFullName: dto.repositoryFullName, serviceName: dto.serviceName, filePaths: sanitized.files.map((file) => file.path) },
        result: result as unknown as Prisma.InputJsonValue,
        secretsRedacted: sanitized.redactedCount,
      },
    });
  }

  async recommendResources(dto: RecommendResourcesDto, userId: string) {
    const services = await this.prisma.service.findMany({
      where: { projectId: dto.projectId, ...(dto.serviceId ? { id: dto.serviceId } : {}), deletedAt: null },
      include: { metrics: { orderBy: { timestamp: "desc" }, take: 60 }, database: true, redisInstance: true },
    });
    if (!services.length) throw new NotFoundException("No services found");
    const currentCpu = this.average(services.flatMap((service) => service.metrics.flatMap((metric) => (metric.cpuPct == null ? [] : [metric.cpuPct]))));
    const currentRam = this.average(services.flatMap((service) => service.metrics.flatMap((metric) => (metric.ramMb == null ? [] : [metric.ramMb]))));
    const result = this.recommendForSignals(
      services.map((service) => String(service.framework)),
      dto.trafficRequestsPerMinute ?? 0,
      currentCpu,
      services.some((service) => !!service.database) || !!dto.databaseSizeMb,
      services.some((service) => !!service.redisInstance),
      currentRam,
      dto.databaseSizeMb,
    );

    return this.prisma.aIAnalysis.create({
      data: {
        organizationId: dto.organizationId,
        projectId: dto.projectId,
        createdById: userId,
        type: "RESOURCES",
        inputMetadata: { serviceIds: services.map((service) => service.id), trafficRequestsPerMinute: dto.trafficRequestsPerMinute ?? null, sampleCount: services.reduce((sum, service) => sum + service.metrics.length, 0) },
        result: result as unknown as Prisma.InputJsonValue,
      },
    });
  }

  list(organizationId: string, projectId?: string) {
    return this.prisma.aIAnalysis.findMany({
      where: { organizationId, projectId },
      include: { proposals: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async applyFix(proposalId: string, dto: ApplyFixDto, userId: string) {
    const proposal = await this.prisma.aIFixProposal.findUnique({ where: { id: proposalId }, include: { analysis: true } });
    if (!proposal) throw new NotFoundException("Fix proposal not found");
    if (proposal.status !== "PENDING_REVIEW" && proposal.status !== "APPROVED") throw new BadRequestException("Fix proposal has already been reviewed");
    const payload = { ...(proposal.payload as JsonObject), ...(dto.overrides ?? {}) };

    await this.prisma.aIFixProposal.update({
      where: { id: proposalId },
      data: { status: "APPROVED", approvedById: userId, approvedAt: new Date(), payload: payload as Prisma.InputJsonValue },
    });

    try {
      switch (proposal.actionType) {
        case "ADD_ENVIRONMENT_VARIABLE":
          await this.envVars.create({
            projectId: String(payload.projectId ?? proposal.analysis.projectId),
            serviceId: payload.serviceId ? String(payload.serviceId) : undefined,
            key: String(payload.key),
            value: String(payload.value ?? "REPLACE_ME"),
            isSecret: true,
          }, userId);
          break;
        case "CHANGE_BUILD_COMMAND":
          await this.services.update(String(payload.serviceId), { buildCommand: String(payload.buildCommand) });
          break;
        case "CHANGE_START_COMMAND":
          await this.services.update(String(payload.serviceId), { startCommand: String(payload.startCommand) });
          break;
        case "CONNECT_DATABASE": {
          const database = await this.databases.create({
            organizationId: proposal.analysis.organizationId,
            name: String(payload.name ?? `ai-database-${proposal.id.slice(-6)}`),
            engine: "POSTGRESQL",
            region: payload.region ? String(payload.region) : undefined,
            resourcePreset: "starter",
          });
          const connection = await this.databases.getConnectionInfo(database.id);
          await this.envVars.create({ projectId: String(payload.projectId ?? proposal.analysis.projectId), serviceId: payload.serviceId ? String(payload.serviceId) : undefined, key: "DATABASE_URL", value: connection.connectionUrl, isSecret: true }, userId);
          break;
        }
        case "REDEPLOY":
          await this.deployments.redeploy(String(payload.deploymentId ?? proposal.analysis.deploymentId), userId);
          break;
        case "GENERATE_DOCKERFILE":
          // Applying this action stores the reviewed Dockerfile as deployment
          // configuration. It intentionally never writes or pushes to Git.
          break;
      }
      return this.prisma.aIFixProposal.update({ where: { id: proposalId }, data: { status: "APPLIED", appliedAt: new Date() } });
    } catch (error) {
      await this.prisma.aIFixProposal.update({ where: { id: proposalId }, data: { status: "FAILED", failureReason: (error as Error).message } });
      throw error;
    }
  }

  rejectFix(proposalId: string, reason?: string) {
    return this.prisma.aIFixProposal.update({ where: { id: proposalId }, data: { status: "REJECTED", failureReason: reason } });
  }

  private sanitizeFiles(files: Array<{ path: string; content?: string }>) {
    const safe: Array<{ path: string; content?: string }> = [];
    const omittedPaths: string[] = [];
    let redactedCount = 0;
    for (const file of files) {
      if (isSensitiveRepositoryPath(file.path)) {
        omittedPaths.push(file.path);
        redactedCount += 1;
        continue;
      }
      if (file.content === undefined) {
        safe.push({ path: file.path });
        continue;
      }
      const redacted = redactSecrets(file.content);
      redactedCount += redacted.redactedCount;
      safe.push({ path: file.path, content: redacted.value });
    }
    return { files: safe, omittedPaths, redactedCount };
  }

  private environmentSuggestions(files: Array<{ path: string; content?: string }>, detection: ReturnType<typeof detectRepositoryStack>) {
    const found = new Set<string>();
    const suggestions: RepositoryAnalysisResult["environmentVariableSuggestions"] = [];
    const source = files.map((file) => file.content ?? "").join("\n");
    for (const match of source.matchAll(/(?:process\.env\.|process\.env\[\s*["']|import\.meta\.env\.|env\(["'])([A-Z][A-Z0-9_]{2,})/g)) found.add(match[1]!);
    if (detection.database) found.add("DATABASE_URL");
    if (detection.redis) found.add("REDIS_URL");
    for (const key of found) {
      suggestions.push({
        key,
        reason: key === "DATABASE_URL" ? "Required by the detected database client." : key === "REDIS_URL" ? "Required by the detected Redis client." : "Referenced by repository source or configuration.",
        secret: /(SECRET|TOKEN|KEY|PASSWORD|URL|DSN)/.test(key),
      });
    }
    return suggestions.sort((a, b) => a.key.localeCompare(b.key));
  }

  private diagnoseLogs(logs: string, serviceId: string | null, serviceName: string | null, projectId: string): LogAnalysisResult {
    const lower = logs.toLowerCase();
    const affectedService = serviceName;
    if (/database_url.{0,80}(missing|undefined|not set|required)|(?:missing|required).{0,80}database_url/i.test(logs)) {
      return {
        problem: "DATABASE_URL is missing",
        explanation: "The application attempted to initialize its database client without a connection URL.",
        affectedService,
        recommendedFix: "Create or select a PostgreSQL database, attach it to this service, inject DATABASE_URL, then redeploy.",
        confidence: 0.98,
        actions: [
          { type: "CONNECT_DATABASE", title: "Create and connect PostgreSQL", explanation: "Provisions PostgreSQL and injects its private connection URL after review.", payload: { projectId, serviceId }, requiresReview: true },
          { type: "REDEPLOY", title: "Redeploy after configuration", explanation: "Starts a fresh deployment after the environment is updated.", payload: {}, requiresReview: true },
        ],
      };
    }
    const missingEnv = logs.match(/(?:environment variable|env(?:ironment)? variable)\s+["'`]?([A-Z][A-Z0-9_]+)["'`]?(?:\s+is)?\s+(?:missing|required|not set|undefined)/i);
    if (missingEnv) {
      return {
        problem: `${missingEnv[1]} is missing`,
        explanation: "A required environment variable was not available to the application process at startup.",
        affectedService,
        recommendedFix: `Add ${missingEnv[1]} to the service environment and redeploy.`,
        confidence: 0.95,
        actions: [
          { type: "ADD_ENVIRONMENT_VARIABLE", title: `Add ${missingEnv[1]}`, explanation: "Adds the required value after you provide and review it.", payload: { projectId, serviceId, key: missingEnv[1], value: "REPLACE_ME" }, requiresReview: true },
          { type: "REDEPLOY", title: "Redeploy service", explanation: "Redeploys the corrected configuration.", payload: {}, requiresReview: true },
        ],
      };
    }
    if (/heap out of memory|oomkilled|out of memory|exit code 137/.test(lower)) {
      return { problem: "Service exceeded its memory limit", explanation: "The process was terminated after exhausting its assigned RAM.", affectedService, recommendedFix: "Increase RAM, inspect memory growth, and redeploy. Autoscaling alone may not fix a per-instance memory leak.", confidence: 0.93, actions: [{ type: "REDEPLOY", title: "Redeploy after resizing", explanation: "Redeploy only after reviewing the resource recommendation.", payload: {}, requiresReview: true }] };
    }
    if (/eaddrinuse|address already in use/.test(lower)) {
      return { problem: "Configured port is already in use", explanation: "The process tried to bind to a port that another process already owns inside the container.", affectedService, recommendedFix: "Run a single application process and bind it to the platform PORT value.", confidence: 0.94, actions: [{ type: "CHANGE_START_COMMAND", title: "Review start command", explanation: "Adjust the start command to launch one server process on the configured port.", payload: { serviceId, startCommand: "npm start" }, requiresReview: true }] };
    }
    if (/module not found|cannot find module|command not found/.test(lower)) {
      return { problem: "A build or runtime dependency is unavailable", explanation: "The image does not contain a required package or executable.", affectedService, recommendedFix: "Verify the install/build command, lockfile, working directory, and production dependency classification.", confidence: 0.86, actions: [{ type: "CHANGE_BUILD_COMMAND", title: "Review build command", explanation: "Update the install/build command after checking the repository package manager.", payload: { serviceId, buildCommand: "npm ci && npm run build" }, requiresReview: true }] };
    }
    if (/connection refused|econnrefused|could not connect/.test(lower)) {
      return { problem: "A dependency refused the connection", explanation: "The service reached a host/port where no healthy dependency accepted the connection.", affectedService, recommendedFix: "Check dependency health, private hostname, port, region placement, and injected connection variables.", confidence: 0.8, actions: [] };
    }
    return { problem: "Deployment failed without a recognized signature", explanation: "The log excerpt does not match a high-confidence CloudDeploy diagnostic rule.", affectedService, recommendedFix: "Inspect the earliest error and its preceding context, verify build/start commands, then retry after a reviewed change.", confidence: 0.35, actions: [] };
  }

  private buildDockerfile(runtime: string, service?: { buildCommand: string | null; startCommand: string | null; port: number | null }): DockerfileGenerationResult {
    if (runtime === "PYTHON") {
      return { path: "Dockerfile", dockerfile: `FROM python:3.12-slim AS runtime\nENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1\nWORKDIR /app\nCOPY requirements.txt ./\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nRUN useradd --create-home app && chown -R app:app /app\nUSER app\nEXPOSE ${service?.port ?? 8000}\nCMD ["sh", "-c", "${service?.startCommand ?? "python app.py"}"]\n`, explanation: "Non-root Python runtime with dependency caching and no package-manager cache.", warnings: ["Review the start command and add a health check endpoint before applying."] };
    }
    if (runtime === "PHP") {
      return { path: "Dockerfile", dockerfile: `FROM composer:2 AS deps\nWORKDIR /app\nCOPY composer.json composer.lock* ./\nRUN composer install --no-dev --no-interaction --prefer-dist\nFROM php:8.3-cli\nWORKDIR /app\nCOPY --from=deps /app/vendor ./vendor\nCOPY . .\nRUN useradd --create-home app && chown -R app:app /app\nUSER app\nEXPOSE ${service?.port ?? 8000}\nCMD ["sh", "-c", "${service?.startCommand ?? "php -S 0.0.0.0:8000 -t public"}"]\n`, explanation: "Multi-stage Composer build with a non-root PHP runtime.", warnings: ["Enable only the PHP extensions your application requires."] };
    }
    return { path: "Dockerfile", dockerfile: `FROM node:22-alpine AS deps\nWORKDIR /app\nCOPY package.json package-lock.json* ./\nRUN npm ci\nFROM node:22-alpine AS build\nWORKDIR /app\nCOPY --from=deps /app/node_modules ./node_modules\nCOPY . .\nRUN ${service?.buildCommand ?? "npm run build"}\nRUN npm prune --omit=dev\nFROM node:22-alpine AS runtime\nENV NODE_ENV=production\nWORKDIR /app\nCOPY --from=build --chown=node:node /app ./\nUSER node\nEXPOSE ${service?.port ?? 3000}\nCMD ["sh", "-c", "${service?.startCommand ?? "npm start"}"]\n`, explanation: "Multi-stage Node.js image that runs as the bundled non-root node user.", warnings: ["Review framework output paths; standalone Next.js builds can use a smaller final stage."] };
  }

  private inferRuntime(files: Array<{ path: string }>) {
    if (files.some((file) => /requirements\.txt|pyproject\.toml/.test(file.path))) return "PYTHON";
    if (files.some((file) => /composer\.json/.test(file.path))) return "PHP";
    return "NODE";
  }

  private recommendForSignals(frameworks: string[], traffic: number, currentCpuPct: number, needsDatabase: boolean, needsRedis: boolean, currentRamMb = 0, databaseSizeMb?: number): ResourceRecommendation {
    const heavy = frameworks.some((framework) => ["NEXTJS", "DJANGO", "LARAVEL", "SPRING_BOOT"].includes(framework));
    const highTraffic = traffic >= 5_000 || currentCpuPct >= 70;
    const cpuCores = highTraffic ? 2 : heavy ? 1 : 0.5;
    const ramMb = Math.max(highTraffic ? 2048 : heavy ? 1024 : 512, currentRamMb ? Math.ceil(currentRamMb * 1.35 / 256) * 256 : 0);
    const instances = highTraffic ? 3 : traffic >= 1_000 ? 2 : 1;
    return {
      cpuCores,
      ramMb,
      instances,
      databaseSizeMb: needsDatabase ? Math.max(4096, Math.ceil((databaseSizeMb ?? 1024) * 1.5 / 1024) * 1024) : null,
      redisSizeMb: needsRedis ? (traffic >= 5_000 ? 1024 : 256) : null,
      rationale: [
        heavy ? "Framework includes server rendering or a full application runtime." : "Detected runtime is suitable for a starter allocation.",
        highTraffic ? "Observed or forecast load warrants multiple replicas." : "Current load fits a single initial replica.",
        "RAM includes approximately 35% headroom above recent usage when metric history exists.",
      ],
    };
  }

  private architectureSummary(serviceCount: number, database: boolean, redis: boolean, storage: boolean) {
    const dependencies = [database && "a managed database", redis && "Redis", storage && "object storage"].filter(Boolean).join(", ");
    return `${serviceCount || 1} application service${serviceCount === 1 ? "" : "s"}${dependencies ? ` with ${dependencies}` : ""}; place stateful dependencies in the same region and expose only public web services through the load balancer.`;
  }

  private architectureConnections(serviceCount: number, database: boolean, redis: boolean, storage: boolean) {
    const connections: Array<{ from: string; to: string; purpose: string }> = [];
    for (let index = 0; index < Math.max(serviceCount, 1); index += 1) {
      if (database) connections.push({ from: `service-${index}`, to: "database", purpose: "private database connection" });
      if (redis) connections.push({ from: `service-${index}`, to: "redis", purpose: "cache and queues" });
      if (storage) connections.push({ from: `service-${index}`, to: "storage", purpose: "durable object storage" });
    }
    return connections;
  }

  private average(values: number[]) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }
}
