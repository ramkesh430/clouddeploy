export interface AutoscalingInput {
  currentInstances: number;
  minimumInstances: number;
  maximumInstances: number;
  averageCpuPct: number;
  averageMemoryPct: number;
  requestsPerMinute: number;
  cpuThresholdPct: number;
  memoryThresholdPct: number;
  requestThreshold?: number | null;
  lastScaleAt?: Date | null;
  scaleUpCooldownSeconds: number;
  scaleDownCooldownSeconds: number;
  now?: Date;
}

export interface AutoscalingDecision {
  desiredInstances: number;
  direction: "UP" | "DOWN" | "NONE";
  reason: string;
}

/** Deterministic horizontal-scaling policy shared by the API and agents.
 * Scale-up reacts to any breached signal; scale-down requires every signal
 * to remain below 50% of its threshold, which prevents oscillation. */
export function calculateDesiredInstances(input: AutoscalingInput): AutoscalingDecision {
  const now = input.now ?? new Date();
  const current = Math.min(input.maximumInstances, Math.max(input.minimumInstances, input.currentInstances));
  const requestBreached = input.requestThreshold != null && input.requestsPerMinute >= input.requestThreshold;
  const upBreached = input.averageCpuPct >= input.cpuThresholdPct || input.averageMemoryPct >= input.memoryThresholdPct || requestBreached;
  const elapsedSeconds = input.lastScaleAt ? (now.getTime() - input.lastScaleAt.getTime()) / 1000 : Number.POSITIVE_INFINITY;

  if (upBreached) {
    if (current >= input.maximumInstances) return { desiredInstances: current, direction: "NONE", reason: "At maximum instance count" };
    if (elapsedSeconds < input.scaleUpCooldownSeconds) return { desiredInstances: current, direction: "NONE", reason: "Scale-up cooldown is active" };
    const desiredInstances = Math.min(input.maximumInstances, Math.max(current + 1, Math.ceil(current * 1.5)));
    const signal = input.averageCpuPct >= input.cpuThresholdPct ? "CPU" : input.averageMemoryPct >= input.memoryThresholdPct ? "memory" : "request rate";
    return { desiredInstances, direction: "UP", reason: `${signal} threshold exceeded` };
  }

  const requestsLow = input.requestThreshold == null || input.requestsPerMinute < input.requestThreshold * 0.5;
  const allLow = input.averageCpuPct < input.cpuThresholdPct * 0.5 && input.averageMemoryPct < input.memoryThresholdPct * 0.5 && requestsLow;
  if (allLow && current > input.minimumInstances) {
    if (elapsedSeconds < input.scaleDownCooldownSeconds) return { desiredInstances: current, direction: "NONE", reason: "Scale-down cooldown is active" };
    return { desiredInstances: Math.max(input.minimumInstances, current - 1), direction: "DOWN", reason: "All signals are below 50% of their thresholds" };
  }

  return { desiredInstances: current, direction: "NONE", reason: "Capacity is within policy thresholds" };
}
