import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { calculateDesiredInstances } from "@clouddeploy/deployment-core";
import { PrismaService } from "../prisma/prisma.service";
import { SchedulerService } from "../infrastructure/scheduler.service";
import { UpsertAutoscalingPolicyDto } from "./dto/autoscaling.dto";

export const AUTOSCALING_QUEUE = "autoscaling";

@Injectable()
export class AutoscalingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    @InjectQueue(AUTOSCALING_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      "autoscaling-evaluator",
      { every: 60_000 },
      { name: "evaluate", data: {}, opts: { removeOnComplete: 10, removeOnFail: 25 } },
    );
  }

  async get(serviceId: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId }, include: { autoscalingPolicy: true, scalingEvents: { orderBy: { createdAt: "desc" }, take: 20 } } });
    if (!service) throw new NotFoundException("Service not found");
    return { policy: service.autoscalingPolicy, currentInstances: service.instances, events: service.scalingEvents };
  }

  async upsert(dto: UpsertAutoscalingPolicyDto) {
    if (dto.maximumInstances < dto.minimumInstances) throw new BadRequestException("Maximum instances must be greater than or equal to minimum instances");
    const service = await this.prisma.service.findFirst({ where: { id: dto.serviceId, projectId: dto.projectId, deletedAt: null } });
    if (!service) throw new NotFoundException("Service not found");
    const { serviceId, projectId, ...policy } = dto;
    const saved = await this.prisma.autoscalingPolicy.upsert({ where: { serviceId }, create: { serviceId, projectId, ...policy }, update: policy });
    if (service.instances < dto.minimumInstances) await this.scheduler.reconcileServiceReplicas(serviceId, dto.minimumInstances);
    if (service.instances > dto.maximumInstances) await this.scheduler.reconcileServiceReplicas(serviceId, dto.maximumInstances);
    return saved;
  }

  async evaluateAll() {
    const policies = await this.prisma.autoscalingPolicy.findMany({ where: { enabled: true }, select: { serviceId: true } });
    const results = [];
    for (const policy of policies) {
      results.push(await this.evaluate(policy.serviceId).catch((error) => ({ serviceId: policy.serviceId, error: (error as Error).message })));
    }
    return results;
  }

  async evaluate(serviceId: string) {
    const policy = await this.prisma.autoscalingPolicy.findUnique({
      where: { serviceId },
      include: { service: { include: { metrics: { where: { timestamp: { gte: new Date(Date.now() - 5 * 60_000) } } } } } },
    });
    if (!policy) throw new NotFoundException("Autoscaling policy not found");
    if (!policy.enabled) return { serviceId, direction: "NONE", desiredInstances: policy.service.instances, reason: "Autoscaling is disabled" };
    const samples = policy.service.metrics;
    if (!samples.length) return { serviceId, direction: "NONE", desiredInstances: policy.service.instances, reason: "Waiting for metric samples" };

    const averageCpuPct = this.average(samples.flatMap((sample) => sample.cpuPct == null ? [] : [sample.cpuPct]));
    const averageRamMb = this.average(samples.flatMap((sample) => sample.ramMb == null ? [] : [sample.ramMb]));
    const averageMemoryPct = policy.service.ramMb ? averageRamMb / policy.service.ramMb * 100 : 0;
    const requestsPerMinute = samples.reduce((sum, sample) => sum + (sample.requestCount ?? 0), 0) / 5;
    const decision = calculateDesiredInstances({
      currentInstances: policy.service.instances,
      minimumInstances: policy.minimumInstances,
      maximumInstances: policy.maximumInstances,
      averageCpuPct,
      averageMemoryPct,
      requestsPerMinute,
      cpuThresholdPct: policy.cpuThresholdPct,
      memoryThresholdPct: policy.memoryThresholdPct,
      requestThreshold: policy.requestThreshold,
      lastScaleAt: policy.lastScaleAt,
      scaleUpCooldownSeconds: policy.scaleUpCooldownSeconds,
      scaleDownCooldownSeconds: policy.scaleDownCooldownSeconds,
    });
    if (decision.direction !== "NONE") {
      await this.scheduler.reconcileServiceReplicas(serviceId, decision.desiredInstances);
      await this.prisma.$transaction([
        this.prisma.autoscalingPolicy.update({ where: { id: policy.id }, data: { lastScaleAt: new Date() } }),
        this.prisma.scalingEvent.create({ data: { serviceId, previousCount: policy.service.instances, desiredCount: decision.desiredInstances, reason: decision.reason, metricSnapshot: { averageCpuPct, averageMemoryPct, requestsPerMinute } } }),
      ]);
    }
    return { serviceId, ...decision, metrics: { averageCpuPct, averageMemoryPct, requestsPerMinute } };
  }

  private average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
}
