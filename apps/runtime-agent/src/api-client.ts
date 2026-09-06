import type { ContainerConnection, ContainerProcess } from "@clouddeploy/docker";
import type { RuntimeAgentEnv } from "./env";

export interface ContainerTelemetryPayload {
  containerId: string;
  cpuPct: number;
  ramPct: number;
  processes: ContainerProcess[];
  connections: ContainerConnection[];
}

export interface HeartbeatPayload {
  agentVersion: string;
  cpuPct: number;
  ramPct: number;
  diskPct: number;
  containerCount: number;
  telemetry: ContainerTelemetryPayload[];
}

export interface HeartbeatResponse {
  accepted: boolean;
  serverId: string;
  nextHeartbeatSeconds: number;
}

export class ApiClient {
  constructor(private readonly env: RuntimeAgentEnv) {}

  async heartbeat(payload: HeartbeatPayload): Promise<HeartbeatResponse> {
    const res = await fetch(`${this.env.API_URL}/api/v1/server-agent/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-agent-token": this.env.AGENT_TOKEN },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Heartbeat rejected: ${res.status} ${res.statusText} ${body}`);
    }
    return res.json() as Promise<HeartbeatResponse>;
  }
}
