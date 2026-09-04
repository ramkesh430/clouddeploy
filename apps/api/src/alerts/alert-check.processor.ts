import { Processor, WorkerHost, InjectQueue, OnWorkerEvent } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AlertsService } from "./alerts.service";

export const ALERT_CHECK_QUEUE = "alert-checks";

@Processor(ALERT_CHECK_QUEUE)
@Injectable()
export class AlertCheckProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger("AlertCheckProcessor");

  constructor(
    private readonly alertsService: AlertsService,
    @InjectQueue(ALERT_CHECK_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  /** Registers the recurring check once on boot — a real BullMQ Job
   * Scheduler (every 60s), not a setInterval, so it survives restarts and
   * won't double-schedule across multiple API instances. */
  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      "alert-evaluation",
      { every: 60_000 },
      { name: "evaluate", opts: { removeOnComplete: 10, removeOnFail: 10 } },
    );
  }

  async process(_job: Job): Promise<void> {
    const result = await this.alertsService.evaluateAll();
    if (result.triggered > 0) {
      this.logger.log(`Alert check: ${result.triggered}/${result.evaluated} rule(s) triggered`);
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, err: Error) {
    this.logger.warn(`Alert check job ${job.id} failed: ${err.message}`);
  }
}
