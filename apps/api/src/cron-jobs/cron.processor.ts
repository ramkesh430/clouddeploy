import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CRON_QUEUE } from "./cron-jobs.service";

/**
 * Executes a cron job run. Command execution itself is simulated (writing
 * realistic log output rather than actually shelling out arbitrary
 * user-provided commands on the control plane — see section 141 on
 * infrastructure adapters and section 91 on build sandboxing: real command
 * execution belongs on an isolated runtime node, never the control plane).
 * The scheduling itself is real: this processor is driven by a genuine
 * BullMQ Job Scheduler on a cron pattern, not a setInterval simulation.
 */
@Processor(CRON_QUEUE)
export class CronProcessor extends WorkerHost {
  private readonly logger = new Logger("CronProcessor");

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CRON_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ cronJobId: string; manual?: boolean }>): Promise<void> {
    const { cronJobId } = job.data;
    const cronJob = await this.prisma.cronJob.findUnique({ where: { id: cronJobId } });
    if (!cronJob || cronJob.status === "PAUSED") return;

    const execution = await this.prisma.cronExecution.create({
      data: { cronJobId, status: "RUNNING" },
    });

    const startedAt = Date.now();
    try {
      await this.delay(800 + Math.random() * 1200);
      const logOutput = [`$ ${cronJob.command}`, `Running "${cronJob.name}"...`, "Done."].join("\n");

      await this.prisma.cronExecution.update({
        where: { id: execution.id },
        data: {
          status: "SUCCEEDED",
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt,
          logOutput,
        },
      });

      const scheduler = await this.queue.getJobScheduler(cronJobId);
      await this.prisma.cronJob.update({
        where: { id: cronJobId },
        data: {
          lastRunAt: new Date(),
          nextRunAt: scheduler?.next ? new Date(scheduler.next) : null,
        },
      });
    } catch (err) {
      this.logger.error(`Cron job ${cronJobId} failed: ${(err as Error).message}`);
      await this.prisma.cronExecution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt,
          logOutput: (err as Error).message,
        },
      });
      await this.prisma.cronJob.update({ where: { id: cronJobId }, data: { lastRunAt: new Date() } });
    }
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
