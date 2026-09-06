import { getContainerConnections, getContainerProcesses, getContainerStats, listContainersByLabel } from "@clouddeploy/docker";
import type { ContainerTelemetryPayload } from "./api-client";

/**
 * Discovers every real, running Docker container this node manages (matched
 * by the `com.clouddeploy.container-id` label — see
 * `docs/phase-3/ARCHITECTURE.md`) and samples its real resource usage,
 * process table, and TCP connections. Returns one entry per container that
 * is still readable; a container that disappears mid-sample (stopped
 * between `docker ps` and the follow-up commands) is silently skipped
 * rather than failing the whole heartbeat.
 */
export async function collectContainerTelemetry(labelKey: string): Promise<ContainerTelemetryPayload[]> {
  const containers = await listContainersByLabel(labelKey);
  const results: ContainerTelemetryPayload[] = [];

  for (const container of containers) {
    const stats = await getContainerStats(container.dockerId);
    if (!stats) continue;
    const [processes, connections] = await Promise.all([
      getContainerProcesses(container.dockerId),
      getContainerConnections(container.dockerId),
    ]);
    results.push({
      containerId: container.label,
      cpuPct: stats.cpuPct,
      ramPct: stats.memPct,
      processes,
      connections,
    });
  }

  return results;
}
