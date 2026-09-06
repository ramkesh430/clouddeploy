import { BadRequestException, Injectable } from "@nestjs/common";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Service } from "@prisma/client";

const SUPPORTED_RUNTIMES = new Set(["NODE", "BUN", "DOCKER"]);

const BASE_IMAGE: Record<string, string> = {
  NODE: "node:20-alpine",
  BUN: "oven/bun:1",
};

/** Emits one real build-log line at a time, so callers can pipe it into
 * whatever log sink they use (DeploymentProcessor writes DeploymentLog rows
 * and pushes them over the WebSocket gateway). */
export type BuildLogger = (line: string) => void | Promise<void>;

/**
 * Builds a real Docker image for one service from its cloned source, using
 * the `docker` CLI directly (spawned via child_process) — the same
 * convention packages/docker/src/exec-adapter.ts already uses, and there is
 * no dockerode dependency anywhere in this repo to instead call the Docker
 * Engine API from Node.
 */
@Injectable()
export class ImageBuildService {
  isSupported(runtime: string): boolean {
    return SUPPORTED_RUNTIMES.has(runtime);
  }

  /** Returns the built image tag. `repoDir` is the cloned repository root;
   * the actual build context is `<repoDir>/<service.rootDirectory>`, so a
   * monorepo with separate frontend/backend folders builds each service
   * from its own subdirectory. */
  async buildImage(service: Service, projectSlug: string, repoDir: string, commitSha: string, onLog: BuildLogger): Promise<string> {
    if (!this.isSupported(service.runtime)) {
      throw new BadRequestException(`Runtime "${service.runtime}" isn't supported by real builds yet (supported: Node, Bun, Docker)`);
    }

    const context = path.resolve(repoDir, service.rootDirectory ?? ".");
    const shortSha = commitSha.slice(0, 7);
    const imageTag = `clouddeploy/${projectSlug}-${service.name}:${shortSha}`.toLowerCase();

    let dockerfilePath = path.join(context, "Dockerfile");
    if (service.runtime !== "DOCKER") {
      if (!service.startCommand) {
        throw new BadRequestException(`Service "${service.name}" has no start command configured — set one before deploying`);
      }
      dockerfilePath = path.join(context, ".clouddeploy.Dockerfile");
      await writeFile(dockerfilePath, this.generateDockerfile(service));
    }

    await onLog(`Building ${imageTag} from ${path.relative(repoDir, context) || "."}`);
    await this.run("docker", ["build", "-f", dockerfilePath, "-t", imageTag, context], onLog);
    return imageTag;
  }

  private generateDockerfile(service: Service): string {
    const install = service.installCommand ?? "npm install";
    const lines = [`FROM ${BASE_IMAGE[service.runtime]}`, "WORKDIR /app", "COPY . .", `RUN ${install}`];
    if (service.buildCommand) lines.push(`RUN ${service.buildCommand}`);
    if (service.port) lines.push(`EXPOSE ${service.port}`);
    lines.push(`CMD ["sh", "-c", ${JSON.stringify(service.startCommand)}]`);
    return lines.join("\n") + "\n";
  }

  private run(command: string, args: string[], onLog: BuildLogger): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args);
      let stderr = "";
      const pipe = (chunk: Buffer) => {
        for (const line of chunk.toString("utf8").split("\n")) {
          if (line.trim()) void onLog(line);
        }
      };
      child.stdout.on("data", pipe);
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
        pipe(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `${command} ${args.join(" ")} exited with code ${code}`));
      });
    });
  }
}
