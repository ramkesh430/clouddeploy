import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "node:child_process";
import net from "node:net";
import type { Service } from "@prisma/client";
import { decryptSecretWithFallback } from "@clouddeploy/security";
import { PrismaService } from "../prisma/prisma.service";

export interface StartedContainer {
  dockerId: string;
  hostPort: number | null;
  tunnelPid: number | null;
  publicUrl: string | null;
}

const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const DOCKER_NETWORK = process.env.DEPLOY_DOCKER_NETWORK ?? "clouddeploy_default";

/**
 * Runs real Docker containers for deployed services on this machine's
 * Docker daemon (shelled out to via the `docker` CLI, matching the
 * convention already used by packages/docker/src/exec-adapter.ts — this
 * repo has no dockerode dependency) and exposes each one publicly with a
 * free per-container `cloudflared` quick tunnel, since there is no real
 * domain to route a shared wildcard hostname under.
 *
 * Single-host MVP: every container runs on this Mac's Docker daemon, the
 * same "one shared real server, not a fleet" fidelity already used by
 * PostgresAdminService/MysqlAdminService for tenant databases.
 */
@Injectable()
export class ContainerRuntimeService {
  private readonly logger = new Logger("ContainerRuntimeService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async ensureAvailable(): Promise<void> {
    try {
      await this.run("docker", ["info"]);
    } catch {
      throw new BadRequestException("Docker isn't reachable on this machine — is Docker Desktop running?");
    }
    try {
      await this.run("which", ["cloudflared"]);
    } catch {
      throw new BadRequestException("cloudflared isn't installed — run `brew install cloudflared` (or your platform's equivalent) to expose real public URLs");
    }
  }

  async startContainer(service: Service, imageTag: string): Promise<StartedContainer> {
    const env = await this.resolveEnvVars(service);
    const containerName = `cd-${service.id}-${Date.now().toString(36)}`;

    const args = [
      "run",
      "-d",
      "--name",
      containerName,
      "--network",
      DOCKER_NETWORK,
      "--cpus",
      String(service.cpuCores),
      "--memory",
      `${service.ramMb}m`,
    ];
    for (const [key, value] of Object.entries(env)) args.push("-e", `${key}=${value}`);
    if (service.port) args.push("-p", `0:${service.port}`);
    args.push(imageTag);

    const dockerId = (await this.run("docker", args)).trim();

    let hostPort: number | null = null;
    if (service.port) {
      const portMapping = (await this.run("docker", ["port", dockerId, `${service.port}/tcp`])).trim();
      // "0.0.0.0:54321" (or "[::]:54321" on some setups) — take the trailing port number.
      const match = portMapping.match(/:(\d+)$/);
      hostPort = match ? Number(match[1]) : null;
    }

    if (hostPort) {
      await this.waitForPort(hostPort);
    }

    let tunnelPid: number | null = null;
    let publicUrl: string | null = null;
    if (hostPort) {
      const tunnel = await this.startTunnel(hostPort);
      tunnelPid = tunnel.pid;
      publicUrl = tunnel.url;
    }

    return { dockerId, hostPort, tunnelPid, publicUrl };
  }

  async stopContainer(dockerId: string | null, tunnelPid: number | null): Promise<void> {
    if (tunnelPid) {
      try {
        process.kill(tunnelPid);
      } catch {
        // Already gone — fine.
      }
    }
    if (dockerId) {
      await this.run("docker", ["stop", dockerId]).catch(() => undefined);
      await this.run("docker", ["rm", "-f", dockerId]).catch(() => undefined);
    }
  }

  private async resolveEnvVars(service: Service): Promise<Record<string, string>> {
    const rows = await this.prisma.environmentVariable.findMany({
      where: { projectId: service.projectId, environment: "PRODUCTION", OR: [{ serviceId: null }, { serviceId: service.id }] },
    });
    const env: Record<string, string> = {};
    for (const row of rows) {
      env[row.key] = decryptSecretWithFallback(row.valueCipher, this.config.getOrThrow("ENCRYPTION_KEY"), this.config.get("ENCRYPTION_KEY_PREVIOUS"));
    }
    if (service.port) env.PORT = String(service.port);
    return env;
  }

  /** Waits for the container's published port to accept TCP connections —
   * treated as "the process actually started" for this MVP, rather than
   * requiring every deployed app to implement a specific HTTP health
   * check contract. */
  private waitForPort(port: number, timeoutMs = 20_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const attempt = () => {
        const socket = net.connect({ port, host: "127.0.0.1" }, () => {
          socket.end();
          resolve();
        });
        socket.on("error", () => {
          socket.destroy();
          if (Date.now() > deadline) reject(new Error(`Container never started listening on port ${port}`));
          else setTimeout(attempt, 500);
        });
      };
      attempt();
    });
  }

  private startTunnel(port: number): Promise<{ pid: number; url: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], { stdio: ["ignore", "pipe", "pipe"] });
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill();
          reject(new Error("Timed out waiting for cloudflared to report a public URL"));
        }
      }, 20_000);

      const onData = (chunk: Buffer) => {
        if (settled) return;
        const match = chunk.toString("utf8").match(TUNNEL_URL_PATTERN);
        if (match) {
          settled = true;
          clearTimeout(timeout);
          child.unref();
          resolve({ pid: child.pid!, url: match[0] });
        }
      };
      child.stdout.on("data", onData);
      child.stderr.on("data", onData);
      child.on("error", (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  private run(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args);
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr.trim() || `${command} ${args.join(" ")} exited with code ${code}`));
      });
    });
  }
}
