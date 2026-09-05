import { calculateDesiredInstances } from "./autoscaling";

describe("calculateDesiredInstances", () => {
  const base = {
    currentInstances: 2,
    minimumInstances: 1,
    maximumInstances: 6,
    averageCpuPct: 40,
    averageMemoryPct: 45,
    requestsPerMinute: 100,
    cpuThresholdPct: 75,
    memoryThresholdPct: 80,
    requestThreshold: 1000,
    scaleUpCooldownSeconds: 120,
    scaleDownCooldownSeconds: 300,
    now: new Date("2026-09-05T10:00:00Z"),
  };

  it("scales up when any threshold is breached", () => {
    expect(calculateDesiredInstances({ ...base, averageCpuPct: 90 })).toMatchObject({ direction: "UP", desiredInstances: 3 });
  });

  it("does not scale during an active cooldown", () => {
    expect(calculateDesiredInstances({ ...base, averageCpuPct: 90, lastScaleAt: new Date("2026-09-05T09:59:00Z") })).toMatchObject({ direction: "NONE", desiredInstances: 2 });
  });

  it("scales down only when all signals are well below threshold", () => {
    expect(calculateDesiredInstances({ ...base, averageCpuPct: 20, averageMemoryPct: 20, requestsPerMinute: 100 })).toMatchObject({ direction: "DOWN", desiredInstances: 1 });
  });

  it("never crosses policy bounds", () => {
    expect(calculateDesiredInstances({ ...base, currentInstances: 6, averageCpuPct: 99 })).toMatchObject({ direction: "NONE", desiredInstances: 6 });
    expect(calculateDesiredInstances({ ...base, currentInstances: 1, averageCpuPct: 1, averageMemoryPct: 1, requestsPerMinute: 0 })).toMatchObject({ direction: "NONE", desiredInstances: 1 });
  });
});
