import { spawn } from "node:child_process";

function run(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", (err) => reject(err));
    child.on("close", (exitCode) => resolve({ stdout, stderr, exitCode: exitCode ?? 0 }));
  });
}

export interface LabeledContainer {
  /** Docker's own container ID. */
  dockerId: string;
  /** The value of the label used to find it — the platform `Container.id`. */
  label: string;
  name: string;
}

/**
 * Finds real, currently-running Docker containers carrying the given label
 * key (the runtime-agent uses `com.clouddeploy.container-id`, set on every
 * container the control plane provisions, to the platform's own
 * `Container.id`). This is how the agent maps a live Docker container back
 * to the platform record it should report telemetry against.
 */
export async function listContainersByLabel(labelKey: string): Promise<LabeledContainer[]> {
  const { stdout, exitCode } = await run(["ps", "--filter", `label=${labelKey}`, "--format", "{{.ID}}\t{{.Names}}\t{{.Label \"" + labelKey + "\"}}"]);
  if (exitCode !== 0) return [];
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [dockerId, name, label] = line.split("\t");
      return { dockerId: dockerId!, name: name ?? "", label: label ?? "" };
    })
    .filter((c) => c.label);
}

export interface ContainerResourceStats {
  cpuPct: number;
  memPct: number;
}

/** Real, instantaneous CPU/memory usage percentages for one running
 * container, read from `docker stats` (a single non-streaming sample). */
export async function getContainerStats(dockerId: string): Promise<ContainerResourceStats | null> {
  const { stdout, exitCode } = await run(["stats", "--no-stream", "--format", "{{.CPUPerc}}\t{{.MemPerc}}", dockerId]);
  if (exitCode !== 0) return null;
  const line = stdout.trim().split("\n")[0];
  if (!line) return null;
  const [cpuRaw, memRaw] = line.split("\t");
  const cpuPct = Number.parseFloat((cpuRaw ?? "0").replace("%", ""));
  const memPct = Number.parseFloat((memRaw ?? "0").replace("%", ""));
  return { cpuPct: Number.isFinite(cpuPct) ? cpuPct : 0, memPct: Number.isFinite(memPct) ? memPct : 0 };
}

export interface ContainerProcess {
  pid: string;
  cpuPct: number;
  command: string;
}

/** The real process table inside a running container, from `docker top`. */
export async function getContainerProcesses(dockerId: string): Promise<ContainerProcess[]> {
  const { stdout, exitCode } = await run(["top", dockerId, "-eo", "pid,pcpu,comm"]);
  if (exitCode !== 0) return [];
  const lines = stdout.trim().split("\n");
  lines.shift(); // header row
  return lines
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 3)
    .map((parts) => ({ pid: parts[0]!, cpuPct: Number.parseFloat(parts[1]!) || 0, command: parts.slice(2).join(" ") }));
}

export interface ContainerConnection {
  remoteIp: string;
  remotePort: number;
  state: string;
}

const TCP_STATES: Record<string, string> = {
  "01": "ESTABLISHED",
  "02": "SYN_SENT",
  "03": "SYN_RECV",
  "04": "FIN_WAIT1",
  "05": "FIN_WAIT2",
  "06": "TIME_WAIT",
  "07": "CLOSE",
  "08": "CLOSE_WAIT",
  "09": "LAST_ACK",
  "0A": "LISTEN",
  "0B": "CLOSING",
};

function parseProcNetTcp(content: string): ContainerConnection[] {
  const lines = content.trim().split("\n");
  lines.shift(); // header
  const connections: ContainerConnection[] = [];
  for (const line of lines) {
    const columns = line.trim().split(/\s+/);
    const remote = columns[2]; // "rem_address" column, hex "IP:PORT"
    const stateHex = columns[3];
    if (!remote || !stateHex) continue;
    const [ipHex, portHex] = remote.split(":");
    if (!ipHex || !portHex) continue;
    const remotePort = Number.parseInt(portHex, 16);
    if (remotePort === 0) continue; // no real remote endpoint yet
    const remoteIp = hexToIpv4(ipHex);
    connections.push({ remoteIp, remotePort, state: TCP_STATES[stateHex.toUpperCase()] ?? stateHex });
  }
  return connections;
}

function hexToIpv4(hex: string): string {
  if (hex.length !== 8) return hex;
  const bytes = [hex.slice(6, 8), hex.slice(4, 6), hex.slice(2, 4), hex.slice(0, 2)];
  return bytes.map((byte) => Number.parseInt(byte, 16)).join(".");
}

/**
 * Real outbound/inbound TCP connections for a running container, read
 * straight from its own `/proc/net/tcp` — no simulated data. Requires the
 * container to have a `cat` (or busybox) binary reachable via `docker exec`;
 * containers built `FROM scratch` have no shell to exec into, so this
 * returns an empty list rather than failing the whole telemetry sample.
 */
export async function getContainerConnections(dockerId: string): Promise<ContainerConnection[]> {
  const results: ContainerConnection[] = [];
  for (const path of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    const { stdout, exitCode } = await run(["exec", dockerId, "cat", path]);
    if (exitCode === 0 && stdout.trim()) results.push(...parseProcNetTcp(stdout));
  }
  return results;
}
