import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { DEPLOYMENT_PIPELINE } from "@clouddeploy/deployment-core";
import { PrismaService } from "../prisma/prisma.service";
import { DeploymentsGateway } from "./deployments.gateway";
import { DEPLOYMENTS_QUEUE } from "./deployments.service";

const STEP_DELAY_MS = 900;

/**
 * Executes the deployment pipeline. This is the local simulation adapter
 * described in section 141 of the spec: it drives the same named steps,
 * statuses, and log stream the real build-worker/runtime-agent will use
 * once Docker BuildKit + Traefik orchestration lands, so the frontend and
 * API contract never have to change when that swap happens.
 */
@Processor(DEPLOYMENTS_QUEUE)
export class DeploymentProcessor extends WorkerHost {
  private readonly logger = new Logger("DeploymentProcessor");

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: DeploymentsGateway,
  ) {
    super();
  }

  async process(job: Job<{ deploymentId: string }>): Promise<void> {
    const { deploymentId } = job.data;
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { project: { include: { services: true } } },
    });
    if (!deployment) {
      this.logger.warn(`Deployment ${deploymentId} disappeared before processing`);
      return;
    }

    await this.prisma.build.create({ data: { deploymentId, status: "RUNNING", startedAt: new Date() } });
    await this.updateStatus(deploymentId, "CLONING", 0, "Clone Repository");
    await this.log(deploymentId, "INFO", `Starting deployment for ${deployment.project.name} (${deployment.branch}@${deployment.commitSha})`);

    const services = deployment.project.services.filter((s) => !s.deletedAt);
    const frontendDetected = services.some((s) => ["WEB_SERVICE", "STATIC_SITE"].includes(s.type));
    const backendDetected = services.some((s) => s.type === "API_SERVICE");

    try {
      for (const step of DEPLOYMENT_PIPELINE) {
        const status = this.statusForStep(step.key);
        await this.updateStatus(deploymentId, status, step.progressAt, step.label);

        for (const line of step.logLines) {
          await this.delay(STEP_DELAY_MS / step.logLines.length);
          await this.log(deploymentId, "INFO", line);
        }

        if (step.key === "analyze") {
          if (frontendDetected) await this.log(deploymentId, "INFO", "Detected Next.js frontend");
          if (backendDetected) await this.log(deploymentId, "INFO", "Detected NestJS backend");
        }
      }

      const dockerImageTag = `clouddeploy/${deployment.project.slug}:${deployment.commitSha}`;
      await this.prisma.build.update({
        where: { deploymentId },
        data: {
          status: "SUCCEEDED",
          dockerImageTag,
          registryPath: `${process.env.REGISTRY_URL ?? "localhost:5001"}/${dockerImageTag}`,
          finishedAt: new Date(),
        },
      });

      await this.prisma.service.updateMany({
        where: { projectId: deployment.projectId, deletedAt: null },
        data: { status: "RUNNING" },
      });

      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "LIVE", progressPct: 100, currentStep: "Deploy Live", finishedAt: new Date() },
      });
      await this.prisma.project.update({
        where: { id: deployment.projectId },
        data: { productionUrl: deployment.project.productionUrl ?? `https://${deployment.project.slug}.clouddeploy.app` },
      });

      this.gateway.emitStatus(deploymentId, { status: "LIVE", progressPct: 100, currentStep: "Deploy Live" });

      await this.prisma.activityLog.create({
        data: {
          organizationId: (await this.prisma.project.findUnique({ where: { id: deployment.projectId } }))!.organizationId,
          projectId: deployment.projectId,
          userId: deployment.triggeredById,
          action: "deployment.success",
          resourceType: "Deployment",
          resourceId: deploymentId,
        },
      });
    } catch (err) {
      await this.log(deploymentId, "ERROR", `Deployment failed: ${(err as Error).message}`);
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "FAILED", errorMessage: (err as Error).message, finishedAt: new Date() },
      });
      await this.prisma.build.update({ where: { deploymentId }, data: { status: "FAILED", finishedAt: new Date() } });
      this.gateway.emitStatus(deploymentId, { status: "FAILED", progressPct: deployment.progressPct, currentStep: null });
      throw err;
    }
  }

  private statusForStep(key: string) {
    if (key === "clone") return "CLONING" as const;
    if (["analyze", "install", "build_frontend", "build_backend", "docker_image"].includes(key)) return "BUILDING" as const;
    if (key === "database") return "DEPLOYING" as const;
    if (["environment", "containers", "domain", "ssl"].includes(key)) return "DEPLOYING" as const;
    if (key === "health_check") return "HEALTH_CHECK" as const;
    return "LIVE" as const;
  }

  private async updateStatus(deploymentId: string, status: string, progressPct: number, currentStep: string) {
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: status as never,
        progressPct,
        currentStep,
        startedAt: progressPct === 0 ? new Date() : undefined,
      },
    });
    this.gateway.emitStatus(deploymentId, { status, progressPct, currentStep });
  }

  private async log(deploymentId: string, level: "INFO" | "WARN" | "ERROR", message: string) {
    const entry = await this.prisma.deploymentLog.create({
      data: { deploymentId, level, message },
    });
    this.gateway.emitLog(deploymentId, { level, message, timestamp: entry.timestamp.toISOString() });
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
