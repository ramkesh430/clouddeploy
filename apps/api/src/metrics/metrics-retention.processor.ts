import { Processor, WorkerHost, InjectQueue, OnWorkerEvent } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { MetricsRetentionService } from "./metrics-retention.service";

export const METRICS_RETENTION_QUEUE = "metrics-retention";

@Processor(METRICS_RETENTION_QUEUE)
@Injectable()
export class MetricsRetentionProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger("MetricsRetentionProcessor");

  constructor(
    private readonly retention: MetricsRetentionService,
    @InjectQueue(METRICS_RETENTION_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  /** A real BullMQ Job Scheduler (hourly), not a setInterval — survives
   * restarts and won't double-schedule across multiple API instances. */
  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      "metrics-retention",
      { every: 60 * 60 * 1000 },
      { name: "run", opts: { removeOnComplete: 5, removeOnFail: 5 } },
    );
  }

  async process(_job: Job): Promise<void> {
    await this.retention.run();
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, err: Error) {
    this.logger.warn(`Metric retention job ${job.id} failed: ${err.message}`);
  }
}
