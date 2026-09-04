import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCronJobDto } from "./dto/create-cron-job.dto";
import { UpdateCronJobDto } from "./dto/update-cron-job.dto";

export const CRON_QUEUE = "cron-executions";

@Injectable()
export class CronJobsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CRON_QUEUE) private readonly queue: Queue,
  ) {}

  async list(projectId: string) {
    return this.prisma.cronJob.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  }

  async create(dto: CreateCronJobDto) {
    const cronJob = await this.prisma.cronJob.create({
      data: {
        projectId: dto.projectId,
        serviceId: dto.serviceId,
        name: dto.name,
        command: dto.command,
        cronExpression: dto.cronExpression,
        timezone: dto.timezone ?? "UTC",
        environment: dto.environment ?? "PRODUCTION",
      },
    });
    await this.schedule(cronJob.id, dto.cronExpression, dto.timezone ?? "UTC");
    return this.syncNextRun(cronJob.id);
  }

  async findOne(cronJobId: string) {
    const cronJob = await this.prisma.cronJob.findUnique({
      where: { id: cronJobId },
      include: { executions: { orderBy: { startedAt: "desc" }, take: 20 } },
    });
    if (!cronJob) throw new NotFoundException("Cron job not found");
    return cronJob;
  }

  async update(cronJobId: string, dto: UpdateCronJobDto) {
    const existing = await this.assertExists(cronJobId);
    const cronJob = await this.prisma.cronJob.update({
      where: { id: cronJobId },
      data: {
        name: dto.name,
        command: dto.command,
        cronExpression: dto.cronExpression,
        timezone: dto.timezone,
        environment: dto.environment,
      },
    });
    if (dto.cronExpression || dto.timezone) {
      await this.schedule(cronJobId, cronJob.cronExpression, cronJob.timezone);
    }
    if (existing.status === "PAUSED") return cronJob;
    return this.syncNextRun(cronJobId);
  }

  async pause(cronJobId: string) {
    await this.assertExists(cronJobId);
    await this.queue.removeJobScheduler(cronJobId);
    return this.prisma.cronJob.update({ where: { id: cronJobId }, data: { status: "PAUSED", nextRunAt: null } });
  }

  async resume(cronJobId: string) {
    const cronJob = await this.assertExists(cronJobId);
    await this.schedule(cronJobId, cronJob.cronExpression, cronJob.timezone);
    await this.prisma.cronJob.update({ where: { id: cronJobId }, data: { status: "ACTIVE" } });
    return this.syncNextRun(cronJobId);
  }

  async remove(cronJobId: string) {
    await this.assertExists(cronJobId);
    await this.queue.removeJobScheduler(cronJobId);
    await this.prisma.cronJob.delete({ where: { id: cronJobId } });
    return { removed: true };
  }

  async trigger(cronJobId: string) {
    await this.assertExists(cronJobId);
    await this.queue.add("run", { cronJobId, manual: true }, { removeOnComplete: 50, removeOnFail: 50 });
    return { triggered: true };
  }

  async listExecutions(cronJobId: string) {
    return this.prisma.cronExecution.findMany({ where: { cronJobId }, orderBy: { startedAt: "desc" }, take: 50 });
  }

  private async schedule(cronJobId: string, pattern: string, tz: string) {
    await this.queue.upsertJobScheduler(
      cronJobId,
      { pattern, tz },
      { name: "run", data: { cronJobId }, opts: { removeOnComplete: 50, removeOnFail: 50 } },
    );
  }

  private async syncNextRun(cronJobId: string) {
    const scheduler = await this.queue.getJobScheduler(cronJobId);
    return this.prisma.cronJob.update({
      where: { id: cronJobId },
      data: { status: "ACTIVE", nextRunAt: scheduler?.next ? new Date(scheduler.next) : null },
    });
  }

  private async assertExists(cronJobId: string) {
    const cronJob = await this.prisma.cronJob.findUnique({ where: { id: cronJobId } });
    if (!cronJob) throw new NotFoundException("Cron job not found");
    return cronJob;
  }
}
