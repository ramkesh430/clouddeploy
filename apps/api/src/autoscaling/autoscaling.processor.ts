import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { AUTOSCALING_QUEUE, AutoscalingService } from "./autoscaling.service";

@Processor(AUTOSCALING_QUEUE)
export class AutoscalingProcessor extends WorkerHost {
  constructor(private readonly autoscaling: AutoscalingService) { super(); }
  async process(job: Job) { if (job.name === "evaluate") await this.autoscaling.evaluateAll(); }
}
