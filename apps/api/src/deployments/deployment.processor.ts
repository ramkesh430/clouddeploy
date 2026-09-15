import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { DEPLOYMENT_PIPELINE } from "@clouddeploy/deployment-core";
import { PrismaService } from "../prisma/prisma.service";
import { DeploymentsGateway } from "./deployments.gateway";
import { DEPLOYMENTS_QUEUE } from "./deployments.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SchedulerService } from "../infrastructure/scheduler.service";
import { ContainerRuntimeService } from "../infrastructure/container-runtime.service";
import { GitCloneService } from "./git-clone.service";
import { ImageBuildService } from "./image-build.service";

const STEP_DELAY_MS = 900;

/**
 * Executes the deployment pipeline. For a project with a connected
 * repository and only Node/Bun/Docker-runtime services, this now does real
 * work — a real `git clone` (GitCloneService), a real `docker build`
 * (ImageBuildService), and a real `docker run` + public tunnel
 * (ContainerRuntimeService, invoked from SchedulerService.
 * reconcileServiceReplicas once a service has a built `imageTag`). A
 * rollback or a template-marketplace deploy skips the clone/build steps —
 * it already has a real image tag (the previous build's, or the template's
 * public image) — and goes straight to running it the same real way. Every
 * other project (no connected repo, or a not-yet-supported runtime) falls
 * back to the local simulation adapter described in section 141 of the
 * spec, unchanged — the step/status/log contract is identical either way,
 * so the frontend never has to know which one ran.
 */
@Processor(DEPLOYMENTS_QUEUE)
export class DeploymentProcessor extends WorkerHost {
  private readonly logger = new Logger("DeploymentProcessor");

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: DeploymentsGateway,
    private readonly webhooks: WebhooksService,
    private readonly notifications: NotificationsService,
    private readonly scheduler: SchedulerService,
    private readonly containerRuntime: ContainerRuntimeService,
    private readonly gitClone: GitCloneService,
    private readonly imageBuild: ImageBuildService,
  ) {
    super();
  }

  async process(job: Job<{ deploymentId: string } | { projectId: string; branch: string }>): Promise<void> {
    if (job.name === "cleanup-preview") {
      return this.cleanupPreview(job.data as { projectId: string; branch: string });
    }

    const { deploymentId } = job.data as { deploymentId: string };
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { project: { include: { services: true } } },
    });
    if (!deployment) {
      this.logger.warn(`Deployment ${deploymentId} disappeared before processing`);
      return;
    }

    // A rollback (see DeploymentsService.rollback) or a template deploy
    // (see TemplatesService.deploy — a pre-built public image needs no
    // build either) both pre-populate a SUCCEEDED Build row with the image
    // to reuse — detect that and skip straight past the clone/build steps
    // rather than rebuilding source that either already built successfully
    // once, or was never built from source in the first place.
    const existingBuild = await this.prisma.build.findUnique({ where: { deploymentId } });
    const reusesImage = existingBuild?.status === "SUCCEEDED" && !!existingBuild.dockerImageTag;
    const isTemplateDeploy = !!deployment.commitSha?.startsWith("template:");
    const isRollback = reusesImage && !isTemplateDeploy;

    const BUILD_STEP_KEYS = new Set(["clone", "analyze", "install", "build_frontend", "build_backend", "docker_image"]);
    const pipeline = reusesImage ? DEPLOYMENT_PIPELINE.filter((s) => !BUILD_STEP_KEYS.has(s.key)) : DEPLOYMENT_PIPELINE;

    if (!reusesImage) {
      const buildWorker = await this.scheduler.chooseBuildWorker(deployment.project.region);
      await this.prisma.build.create({ data: { deploymentId, buildWorkerId: buildWorker?.id, status: "RUNNING", startedAt: new Date() } });
    }
    await this.updateStatus(deploymentId, reusesImage ? "DEPLOYING" : "CLONING", 0, reusesImage ? "Start Containers" : "Clone Repository");

    if (isRollback) {
      await this.log(deploymentId, "INFO", `Rolling back — reusing existing image ${existingBuild!.dockerImageTag} (no rebuild)`);
    } else if (isTemplateDeploy) {
      await this.log(deploymentId, "INFO", `Deploying from template — using pre-built image ${existingBuild!.dockerImageTag} (no build needed)`);
    } else {
      await this.log(deploymentId, "INFO", `Starting deployment for ${deployment.project.name} (${deployment.branch}@${deployment.commitSha})`);
    }

    await this.webhooks.dispatch(
      deployment.project.organizationId,
      "deployment.started",
      { deploymentId, projectId: deployment.projectId, branch: deployment.branch, commitSha: deployment.commitSha },
      deployment.projectId,
    );

    const services = deployment.project.services.filter((s) => !s.deletedAt);
    const frontendDetected = services.some((s) => ["WEB_SERVICE", "STATIC_SITE"].includes(s.type));
    const backendDetected = services.some((s) => s.type === "API_SERVICE");

    const deployableServices = services.filter((service) =>
      !["POSTGRES", "MYSQL", "MARIADB", "REDIS", "OBJECT_STORAGE"].includes(service.type) &&
      (!deployment.serviceId || service.id === deployment.serviceId),
    );

    // A fresh build needs a connected repository and a runtime
    // ImageBuildService actually supports. A rollback or template deploy
    // already has a real image tag sitting in existingBuild — Docker is the
    // only thing standing between it and a real container (no clone/build
    // needed either way), so it skips straight to the ensureAvailable check
    // below. Everything else — the vast majority of existing projects,
    // which have no connected repository at all — keeps the simulated path.
    const connectedRepo = !reusesImage ? await this.gitClone.getConnectedRepository(deployment.projectId) : null;
    const unsupportedRuntime = !reusesImage ? deployableServices.find((s) => !this.imageBuild.isSupported(s.runtime)) : undefined;
    let canDeployReal = reusesImage ? true : !!connectedRepo && !unsupportedRuntime;
    let downgradeReason: string | null = reusesImage
      ? null
      : !connectedRepo
        ? "No connected repository"
        : unsupportedRuntime
          ? `Runtime "${unsupportedRuntime.runtime}" (service "${unsupportedRuntime.name}") isn't supported by real builds yet`
          : null;

    if (canDeployReal) {
      try {
        await this.containerRuntime.ensureAvailable();
      } catch (err) {
        canDeployReal = false;
        downgradeReason = (err as Error).message;
      }
    }

    // Stamp the reused image onto the service Docker will actually run.
    // Without this, a rollback's own container would keep running whatever
    // the *latest* real build last set here (rollback would be a no-op for
    // the running code), and a template deploy would never get a real
    // container at all. Restricted to the single-service case because
    // existingBuild carries exactly one image tag but a whole-project
    // (serviceId-less) rollback can span several services.
    if (reusesImage && canDeployReal && deployableServices.length === 1) {
      await this.prisma.service.update({
        where: { id: deployableServices[0]!.id },
        data: {
          imageTag: existingBuild!.dockerImageTag,
          imageDigest: existingBuild!.imageDigest,
          imageSignature: existingBuild!.imageSignature,
        },
      });
    }

    let clonedDir: string | null = null;
    const realImageTags = new Map<string, string>();

    if (!canDeployReal && downgradeReason) {
      await this.log(deploymentId, "INFO", `${downgradeReason} — using simulated deployment`);
    }

    try {
      for (const step of pipeline) {
        const status = this.statusForStep(step.key);
        await this.updateStatus(deploymentId, status, step.progressAt, step.label);

        if (canDeployReal && step.key === "clone") {
          await this.log(deploymentId, "INFO", `Cloning ${connectedRepo!.fullName}@${deployment.branch}...`);
          const cloned = await this.gitClone.cloneRepository(deployment.projectId, deployment.branch);
          clonedDir = cloned.dir;
          if (cloned.commitSha !== deployment.commitSha) {
            await this.prisma.deployment.update({ where: { id: deploymentId }, data: { commitSha: cloned.commitSha } });
            deployment.commitSha = cloned.commitSha;
          }
          await this.log(deploymentId, "INFO", `Cloned at commit ${cloned.commitSha.slice(0, 7)}`);
        } else if (canDeployReal && step.key === "docker_image") {
          for (const service of deployableServices) {
            const built = await this.imageBuild.buildImage(
              service,
              deployment.project.slug,
              clonedDir!,
              deployment.commitSha!,
              (line) => this.log(deploymentId, "INFO", line),
            );
            realImageTags.set(service.id, built.tag);
            await this.prisma.service.update({
              where: { id: service.id },
              data: { imageTag: built.tag, imageDigest: built.digest, imageSignature: built.signature },
            });
            await this.prisma.build.update({
              where: { deploymentId },
              data: {
                imageDigest: built.digest,
                imageSignature: built.signature,
                scanStatus: built.scanStatus,
                scanCriticalCount: built.scanCriticalCount,
                scanHighCount: built.scanHighCount,
              },
            });
          }
        } else {
          for (const line of step.logLines) {
            await this.delay(STEP_DELAY_MS / step.logLines.length);
            await this.log(deploymentId, "INFO", line);
          }
        }

        if (step.key === "analyze") {
          if (frontendDetected) await this.log(deploymentId, "INFO", "Detected Next.js frontend");
          if (backendDetected) await this.log(deploymentId, "INFO", "Detected NestJS backend");
        }
      }

      if (!reusesImage) {
        const primaryTag = realImageTags.get(deployableServices[0]?.id ?? "") ?? `clouddeploy/${deployment.project.slug}:${deployment.commitSha}`;
        await this.prisma.build.update({
          where: { deploymentId },
          data: {
            status: "SUCCEEDED",
            dockerImageTag: primaryTag,
            registryPath: canDeployReal ? null : `${process.env.REGISTRY_URL ?? "localhost:5001"}/${primaryTag}`,
            finishedAt: new Date(),
          },
        });
      }

      await this.prisma.service.updateMany({
        where: { projectId: deployment.projectId, deletedAt: null },
        data: { status: "RUNNING" },
      });

      const platformDomain = process.env.PLATFORM_DOMAIN ?? "clouddeploy.app";
      const isPreview = deployment.environment === "PREVIEW";
      const previewUrl = isPreview && !canDeployReal
        ? `${this.slugify(deployment.branch)}-${deploymentId.slice(0, 6)}.${platformDomain}`
        : undefined;
      // Reconciled below once real containers are up (real path only) —
      // used for the webhook/notification payloads either way.
      let finalPreviewUrl = previewUrl;

      if (!canDeployReal) {
        await this.prisma.deployment.update({
          where: { id: deploymentId },
          data: { status: "LIVE", progressPct: 100, currentStep: "Deploy Live", finishedAt: new Date(), previewUrl },
        });
        if (isPreview) {
          await this.log(deploymentId, "INFO", `Preview deployment ready at https://${previewUrl}`);
        } else {
          await this.prisma.project.update({
            where: { id: deployment.projectId },
            data: { productionUrl: deployment.project.productionUrl ?? `https://${deployment.project.slug}.clouddeploy.app` },
          });
        }
      }

      for (const service of deployableServices) {
        if (!canDeployReal && service.port && !service.isPrivate && !service.publicUrl) {
          await this.prisma.service.update({
            where: { id: service.id },
            data: { publicUrl: `https://${service.name}-${deployment.project.slug}.${platformDomain}` },
          });
        }
        await this.scheduler.reconcileServiceReplicas(service.id, service.instances, deploymentId);
      }

      if (canDeployReal) {
        // Real public URLs are only known once reconcileServiceReplicas has
        // actually started each container (it writes Service.publicUrl
        // itself) — read them back rather than guessing a template here.
        const refreshed = await this.prisma.service.findMany({ where: { id: { in: deployableServices.map((s) => s.id) } } });
        const primaryUrl = refreshed.find((s) => ["WEB_SERVICE", "STATIC_SITE"].includes(s.type))?.publicUrl ?? refreshed.find((s) => s.publicUrl)?.publicUrl;
        if (isPreview) finalPreviewUrl = primaryUrl ?? undefined;
        await this.prisma.deployment.update({
          where: { id: deploymentId },
          data: { status: "LIVE", progressPct: 100, currentStep: "Deploy Live", finishedAt: new Date(), previewUrl: finalPreviewUrl },
        });
        if (primaryUrl && !isPreview) {
          await this.prisma.project.update({ where: { id: deployment.projectId }, data: { productionUrl: primaryUrl } });
        }
        for (const service of refreshed) {
          if (service.publicUrl) await this.log(deploymentId, "INFO", `${service.name} is live at ${service.publicUrl}`);
        }
      }

      this.gateway.emitStatus(deploymentId, { status: "LIVE", progressPct: 100, currentStep: "Deploy Live" });

      const organizationId = deployment.project.organizationId;

      await this.prisma.activityLog.create({
        data: {
          organizationId,
          projectId: deployment.projectId,
          userId: deployment.triggeredById,
          action: isRollback ? "deployment.rollback" : "deployment.success",
          resourceType: "Deployment",
          resourceId: deploymentId,
        },
      });

      await this.webhooks.dispatch(
        organizationId,
        "deployment.success",
        { deploymentId, projectId: deployment.projectId, branch: deployment.branch, commitSha: deployment.commitSha, previewUrl: finalPreviewUrl },
        deployment.projectId,
      );

      const successTitle = `${deployment.project.name} deployed successfully`;
      const successMessage = `${deployment.branch}@${deployment.commitSha} is now live${isPreview ? " (preview)" : ""}.`;
      if (deployment.triggeredById) {
        await this.notifications.notify(organizationId, deployment.triggeredById, "DEPLOYMENT_SUCCESSFUL", successTitle, successMessage);
      } else {
        await this.notifications.notifyOrganization(organizationId, "DEPLOYMENT_SUCCESSFUL", successTitle, successMessage);
      }
    } catch (err) {
      await this.log(deploymentId, "ERROR", `Deployment failed: ${(err as Error).message}`);
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "FAILED", errorMessage: (err as Error).message, finishedAt: new Date() },
      });
      // When reusing an image (rollback or template deploy), the build stays
      // SUCCEEDED — it's a known-good image, not something that just failed
      // to build — only a fresh build's own failure should mark it FAILED.
      if (!reusesImage) {
        await this.prisma.build.update({ where: { deploymentId }, data: { status: "FAILED", finishedAt: new Date() } });
      }
      this.gateway.emitStatus(deploymentId, { status: "FAILED", progressPct: deployment.progressPct, currentStep: null });

      const organizationId = deployment.project.organizationId;
      await this.webhooks.dispatch(
        organizationId,
        "deployment.failed",
        { deploymentId, projectId: deployment.projectId, branch: deployment.branch, error: (err as Error).message },
        deployment.projectId,
      );
      const failTitle = `${deployment.project.name} deployment failed`;
      const failMessage = `${deployment.branch}@${deployment.commitSha}: ${(err as Error).message}`;
      if (deployment.triggeredById) {
        await this.notifications.notify(organizationId, deployment.triggeredById, "DEPLOYMENT_FAILED", failTitle, failMessage);
      } else {
        await this.notifications.notifyOrganization(organizationId, "DEPLOYMENT_FAILED", failTitle, failMessage);
      }

      throw err;
    } finally {
      if (clonedDir) await this.gitClone.cleanup(clonedDir);
    }
  }

  /** Tears down preview deployments for a branch after its PR closes. */
  private async cleanupPreview({ projectId, branch }: { projectId: string; branch: string }): Promise<void> {
    const live = await this.prisma.deployment.findMany({
      where: { projectId, branch, environment: "PREVIEW", status: "LIVE" },
    });
    if (live.length === 0) return;

    await this.prisma.deployment.updateMany({
      where: { id: { in: live.map((d) => d.id) } },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });

    for (const d of live) {
      await this.log(d.id, "INFO", "Preview environment removed (pull request closed).");
      this.gateway.emitStatus(d.id, { status: "CANCELLED", progressPct: d.progressPct, currentStep: "Preview removed" });
    }

    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
    if (project) {
      await this.prisma.activityLog.create({
        data: {
          organizationId: project.organizationId,
          projectId,
          action: "preview.removed",
          resourceType: "Deployment",
          resourceId: live[0]!.id,
        },
      });
    }
    this.logger.log(`Removed ${live.length} preview deployment(s) for ${projectId}@${branch}`);
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

  private slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
}
