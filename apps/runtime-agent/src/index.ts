import { ApiClient } from "./api-client";
import { collectContainerTelemetry } from "./collector";
import { loadEnv } from "./env";
import { diskPct, ramPct, sampleCpuPct } from "./host-metrics";

/**
 * Runtime-agent entrypoint. Runs on a runtime node, reports real host and
 * per-container telemetry to the control plane on a fixed interval, and
 * lets `POST /server-agent/heartbeat` turn that telemetry into RiskEvent
 * rows via `detectContainerRisks` (see @clouddeploy/deployment-core).
 *
 * This binary does not itself decide what counts as abuse — it only
 * collects and reports facts. That split keeps detection policy in one
 * place (the control plane, unit-tested independently of any live
 * container) and keeps the agent simple enough to trust on every node.
 */
async function main() {
  const env = loadEnv();
  const client = new ApiClient(env);

  console.log(`[runtime-agent] starting — reporting to ${env.API_URL} every ${env.HEARTBEAT_INTERVAL_MS}ms`);

  let running = true;
  process.on("SIGTERM", () => (running = false));
  process.on("SIGINT", () => (running = false));

  while (running) {
    const cycleStart = Date.now();
    try {
      const [cpu, disk, telemetry] = await Promise.all([
        sampleCpuPct(),
        diskPct(),
        collectContainerTelemetry(env.CONTAINER_LABEL_KEY),
      ]);

      await client.heartbeat({
        agentVersion: env.AGENT_VERSION,
        cpuPct: cpu,
        ramPct: ramPct(),
        diskPct: disk,
        containerCount: telemetry.length,
        telemetry,
      });

      console.log(
        `[runtime-agent] heartbeat accepted — host cpu=${cpu.toFixed(1)}% containers=${telemetry.length}` +
          (telemetry.length ? ` (${telemetry.map((t) => `${t.containerId}:${t.cpuPct.toFixed(0)}%`).join(", ")})` : ""),
      );
    } catch (err) {
      console.error(`[runtime-agent] heartbeat failed: ${(err as Error).message}`);
    }

    const elapsed = Date.now() - cycleStart;
    const wait = Math.max(0, env.HEARTBEAT_INTERVAL_MS - elapsed);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  console.log("[runtime-agent] shutting down");
}

main().catch((err) => {
  console.error("[runtime-agent] fatal error:", err);
  process.exit(1);
});
