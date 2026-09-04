import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDeploymentDto } from "./dto/create-deployment.dto";

export const DEPLOYMENTS_QUEUE = "deployments";

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DEPLOYMENTS_QUEUE) private readonly queue: Queue,
  ) {}

  async list(projectId: string) {
    return this.prisma.deployment.findMany({
      where: { projectId },
      include: {
        service: { select: { name: true, framework: true } },
        triggeredBy: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        build: { select: { dockerImageTag: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async findOne(deploymentId: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        logs: { orderBy: { timestamp: "asc" } },
        service: true,
        project: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!deployment) throw new NotFoundException("Deployment not found");
    return deployment;
  }

  async create(
    dto: CreateDeploymentDto,
    triggeredById: string | undefined,
    isAutoDeploy = false,
    commitOverride?: { sha: string; message: string },
    reuseBuild?: { dockerImageTag: string; registryPath: string | null },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      include: { repository: true },
    });
    if (!project) throw new NotFoundException("Project not found");

    const deployment = await this.prisma.deployment.create({
      data: {
        projectId: dto.projectId,
        serviceId: dto.serviceId,
        environment: dto.environment ?? "PRODUCTION",
        branch: dto.branch ?? project.repository?.defaultBranch ?? "main",
        commitSha: commitOverride?.sha ?? this.fakeCommitSha(),
        commitMessage: commitOverride?.message ?? (isAutoDeploy ? "Auto-deploy on push" : "Manual deploy"),
        triggeredById,
        isAutoDeploy,
        status: "QUEUED",
      },
    });

    // Rollback path: the image already exists from a previous successful
    // build, so pre-populate a SUCCEEDED Build row — the processor detects
    // this and skips straight past clone/build to "start containers",
    // rather than rebuilding source it already built once.
    if (reuseBuild) {
      await this.prisma.build.create({
        data: {
          deploymentId: deployment.id,
          status: "SUCCEEDED",
          dockerImageTag: reuseBuild.dockerImageTag,
          registryPath: reuseBuild.registryPath,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      });
    }

    await this.queue.add("run-deployment", { deploymentId: deployment.id }, { removeOnComplete: 100, removeOnFail: 100 });
    return deployment;
  }

  async redeploy(deploymentId: string, triggeredById: string) {
    const previous = await this.findOne(deploymentId);
    return this.create(
      {
        projectId: previous.projectId,
        serviceId: previous.serviceId ?? undefined,
        branch: previous.branch,
        environment: previous.environment,
      },
      triggeredById,
    );
  }

  async rollback(deploymentId: string, targetDeploymentId: string, triggeredById: string) {
    const target = await this.prisma.deployment.findUnique({
      where: { id: targetDeploymentId },
      include: { build: true },
    });
    if (!target || target.status !== "LIVE") {
      throw new NotFoundException("Target deployment is not a healthy, live deployment");
    }
    if (!target.build || target.build.status !== "SUCCEEDED" || !target.build.dockerImageTag) {
      throw new NotFoundException("Target deployment has no successful build image to roll back to");
    }

    const rollback = await this.create(
      {
        projectId: target.projectId,
        serviceId: target.serviceId ?? undefined,
        branch: target.branch,
        environment: target.environment,
      },
      triggeredById,
      false,
      { sha: target.commitSha ?? this.fakeCommitSha(), message: `Rollback to #${target.id.slice(0, 8)}` },
      { dockerImageTag: target.build.dockerImageTag, registryPath: target.build.registryPath },
    );
    await this.prisma.deployment.update({ where: { id: deploymentId }, data: { status: "ROLLED_BACK" } });
    return rollback;
  }

  async cancel(deploymentId: string) {
    return this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
  }

  /** Schedules a preview environment's teardown after a configurable delay
   * (default 30 min, PREVIEW_CLEANUP_DELAY_MS) — used when a GitHub PR
   * closes. A real BullMQ delayed job, not a timeout, so it survives an API
   * restart in between. */
  async schedulePreviewCleanup(projectId: string, branch: string, delayMs?: number) {
    const delay = delayMs ?? Number(process.env.PREVIEW_CLEANUP_DELAY_MS ?? 30 * 60 * 1000);
    await this.queue.add("cleanup-preview", { projectId, branch }, { delay, removeOnComplete: 50, removeOnFail: 50 });
  }

  private fakeCommitSha(): string {
    return Math.random().toString(16).slice(2, 9);
  }
}
