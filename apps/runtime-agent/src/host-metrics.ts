import { exec } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);

function cpuTimes() {
  return os.cpus().reduce(
    (totals, cpu) => {
      totals.idle += cpu.times.idle;
      totals.total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
      return totals;
    },
    { idle: 0, total: 0 },
  );
}

/** Real host CPU utilization, sampled as a delta over `sampleMs` — a single
 * point-in-time read of `os.cpus()` is a cumulative counter since boot, not
 * a percentage, so this takes two samples and diffs them (the standard
 * technique; matches what `top`/`docker stats` do internally). */
export async function sampleCpuPct(sampleMs = 500): Promise<number> {
  const start = cpuTimes();
  await new Promise((resolve) => setTimeout(resolve, sampleMs));
  const end = cpuTimes();
  const idleDelta = end.idle - start.idle;
  const totalDelta = end.total - start.total;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
}

/** Real host memory utilization from `os.totalmem`/`os.freemem`. */
export function ramPct(): number {
  const total = os.totalmem();
  const free = os.freemem();
  if (total <= 0) return 0;
  return ((total - free) / total) * 100;
}

/** Real disk utilization for the root filesystem, from `df` — the same
 * source an operator would check by hand. */
export async function diskPct(path = "/"): Promise<number> {
  try {
    const { stdout } = await execAsync(`df -kP ${path}`);
    const line = stdout.trim().split("\n")[1];
    const usePctColumn = line?.trim().split(/\s+/)[4];
    const parsed = Number.parseFloat((usePctColumn ?? "0").replace("%", ""));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}
