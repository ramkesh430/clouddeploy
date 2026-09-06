export type DetectedRiskType =
  | "CPU_ABUSE"
  | "RAM_ABUSE"
  | "OUTBOUND_CONNECTION"
  | "SUSPICIOUS_PROCESS"
  | "CRYPTO_MINING"
  | "PORT_SCANNING";

export type RiskSeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TelemetryProcess {
  pid: string;
  cpuPct: number;
  command: string;
}

export interface TelemetryConnection {
  remoteIp: string;
  remotePort: number;
  state: string;
}

export interface ContainerTelemetry {
  containerId: string;
  cpuPct: number;
  ramPct: number;
  processes: TelemetryProcess[];
  connections: TelemetryConnection[];
}

export interface AbuseThresholds {
  cpuAbusePct: number;
  ramAbusePct: number;
  /** Distinct remote IPs contacted in one sample above which egress looks abnormal. */
  outboundDistinctIpThreshold: number;
  /** Distinct remote ports in SYN_SENT state above which the container looks like it's scanning outward. */
  portScanDistinctPortThreshold: number;
}

export const DEFAULT_ABUSE_THRESHOLDS: AbuseThresholds = {
  cpuAbusePct: 90,
  ramAbusePct: 90,
  outboundDistinctIpThreshold: 50,
  portScanDistinctPortThreshold: 20,
};

// Process-name substrings for widely-used cryptocurrency miners. Matching is
// case-insensitive against the full command line reported by `docker top`.
const MINER_PROCESS_PATTERNS = [
  "xmrig", "minerd", "cpuminer", "ethminer", "cgminer", "bfgminer",
  "nheqminer", "ccminer", "t-rex", "phoenixminer", "lolminer", "nbminer",
  "teamredminer", "gminer", "srbminer", "xmr-stak",
];

// Command-line fragments commonly seen in reverse shells and dropper
// one-liners. This is a coarse heuristic, not a signature scanner — it
// exists to surface an event for human review, not to auto-convict.
const SUSPICIOUS_COMMAND_PATTERNS = [
  /nc\s+-e/i,
  /\/dev\/tcp\//i,
  /bash\s+-i\s+>&\s*\/dev\/tcp/i,
  /wget.*\|\s*sh/i,
  /curl.*\|\s*(sh|bash)/i,
  /base64\s+-d.*\|\s*(sh|bash)/i,
  /mkfifo\s+\/tmp\//i,
];

// TCP/UDP ports historically associated with mining-pool stratum protocols.
const MINING_POOL_PORTS = new Set([3333, 4444, 5555, 7777, 8333, 9999, 14444, 45700]);

export interface DetectedRisk {
  type: DetectedRiskType;
  severity: RiskSeverityLevel;
  title: string;
  evidence: Record<string, unknown>;
  recommendedActions: string[];
}

/**
 * Deterministic abuse-detection policy shared by the control plane (and
 * unit-testable independent of any live container). Runtime-agents report
 * raw, real per-container telemetry; this function turns one sample into
 * zero or more risk findings — it decides nothing on its own, it only
 * proposes findings for the control plane to persist and an admin to act on.
 */
export function detectContainerRisks(
  telemetry: ContainerTelemetry,
  thresholds: AbuseThresholds = DEFAULT_ABUSE_THRESHOLDS,
): DetectedRisk[] {
  const risks: DetectedRisk[] = [];

  if (telemetry.cpuPct >= thresholds.cpuAbusePct) {
    risks.push({
      type: "CPU_ABUSE",
      severity: telemetry.cpuPct >= 99 ? "HIGH" : "MEDIUM",
      title: `Container is sustaining ${telemetry.cpuPct.toFixed(1)}% CPU`,
      evidence: { cpuPct: telemetry.cpuPct, thresholdPct: thresholds.cpuAbusePct },
      recommendedActions: ["Review process list", "Contact organization owner", "Consider suspending the project if unexplained"],
    });
  }

  if (telemetry.ramPct >= thresholds.ramAbusePct) {
    risks.push({
      type: "RAM_ABUSE",
      severity: telemetry.ramPct >= 99 ? "HIGH" : "MEDIUM",
      title: `Container is sustaining ${telemetry.ramPct.toFixed(1)}% memory`,
      evidence: { ramPct: telemetry.ramPct, thresholdPct: thresholds.ramAbusePct },
      recommendedActions: ["Review process list", "Recommend a larger plan or investigate a memory leak"],
    });
  }

  const minerProcess = telemetry.processes.find((proc) =>
    MINER_PROCESS_PATTERNS.some((pattern) => proc.command.toLowerCase().includes(pattern)),
  );
  if (minerProcess) {
    risks.push({
      type: "CRYPTO_MINING",
      severity: "CRITICAL",
      title: `Cryptocurrency miner process detected: ${minerProcess.command}`,
      evidence: { pid: minerProcess.pid, command: minerProcess.command, cpuPct: minerProcess.cpuPct },
      recommendedActions: ["Terminate containers", "Suspend project", "Manual review"],
    });
  }

  const suspiciousProcess = telemetry.processes.find((proc) =>
    SUSPICIOUS_COMMAND_PATTERNS.some((pattern) => pattern.test(proc.command)),
  );
  if (suspiciousProcess) {
    risks.push({
      type: "SUSPICIOUS_PROCESS",
      severity: "HIGH",
      title: `Suspicious command line detected: ${suspiciousProcess.command}`,
      evidence: { pid: suspiciousProcess.pid, command: suspiciousProcess.command },
      recommendedActions: ["Manual review", "Terminate containers if confirmed malicious"],
    });
  }

  const miningPoolConnection = telemetry.connections.find((conn) => MINING_POOL_PORTS.has(conn.remotePort));
  const distinctOutboundIps = new Set(telemetry.connections.map((conn) => conn.remoteIp)).size;
  if (miningPoolConnection || distinctOutboundIps >= thresholds.outboundDistinctIpThreshold) {
    risks.push({
      type: "OUTBOUND_CONNECTION",
      severity: miningPoolConnection ? "CRITICAL" : "MEDIUM",
      title: miningPoolConnection
        ? `Outbound connection to a known mining-pool port ${miningPoolConnection.remotePort}`
        : `Container has ${distinctOutboundIps} distinct outbound connections in one sample`,
      evidence: {
        distinctOutboundIps,
        miningPoolConnection: miningPoolConnection ?? null,
        sampledConnectionCount: telemetry.connections.length,
      },
      recommendedActions: ["Manual review", "Terminate containers if confirmed malicious"],
    });
  }

  const synSentPorts = new Set(
    telemetry.connections.filter((conn) => conn.state === "SYN_SENT").map((conn) => conn.remotePort),
  );
  if (synSentPorts.size >= thresholds.portScanDistinctPortThreshold) {
    risks.push({
      type: "PORT_SCANNING",
      severity: "HIGH",
      title: `Container attempted ${synSentPorts.size} distinct outbound ports in one sample`,
      evidence: { distinctPortsAttempted: synSentPorts.size, sampledConnectionCount: telemetry.connections.length },
      recommendedActions: ["Manual review", "Terminate containers", "Suspend project"],
    });
  }

  return risks;
}
