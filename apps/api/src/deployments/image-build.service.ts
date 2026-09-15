import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Service } from "@prisma/client";
import {
  dockerBuildArgs,
  evaluateImagePolicy,
  generateRuntimeDockerfile,
  parseTrivyCriticalCount,
  signImageDigest,
} from "@clouddeploy/docker";

const SUPPORTED_RUNTIMES = new Set(["NODE", "BUN", "DOCKER"]);

export type BuildLogger = (line: string) => void | Promise<void>;

export interface BuiltImage {
  tag: string;
  digest: string;
  signature: string;
  scanStatus: "PASSED" | "FAILED" | "SKIPPED";
  scanCriticalCount: number;
  scanHighCount: number;
}

@Injectable()
export class ImageBuildService {
  constructor(private readonly config: ConfigService) {}

  isSupported(runtime: string): boolean {
    return SUPPORTED_RUNTIMES.has(runtime);
  }

  async buildImage(service: Service, projectSlug: string, repoDir: string, commitSha: string, onLog: BuildLogger): Promise<BuiltImage> {
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
      await writeFile(
        dockerfilePath,
        generateRuntimeDockerfile(
          service.runtime,
          service.installCommand ?? "npm install",
          service.startCommand,
          service.buildCommand,
          service.port,
        ),
      );
    }

    await onLog(`Building ${imageTag} from ${path.relative(repoDir, context) || "."} (BuildKit, pull-fresh base)`);
    await this.run("docker", dockerBuildArgs(dockerfilePath, imageTag, context), onLog);

    const digest = (await this.run("docker", ["inspect", "--format", "{{.Id}}", imageTag], onLog)).trim();
    const user = (await this.run("docker", ["inspect", "--format", "{{.Config.User}}", imageTag], onLog)).trim();
    const signingKey = this.config.getOrThrow<string>("ENCRYPTION_KEY");
    const signature = signImageDigest(digest, signingKey);

    const policy = evaluateImagePolicy({ user, digest });
    for (const finding of policy) {
      await onLog(`[scan:${finding.severity}] ${finding.code}: ${finding.message}`);
    }

    let scanCriticalCount = policy.filter((f) => f.severity === "CRITICAL").length;
    let scanHighCount = policy.filter((f) => f.severity === "HIGH").length;

    const trivy = await this.runTrivy(imageTag, onLog);
    scanCriticalCount += trivy.critical;
    scanHighCount += trivy.high;

    const failOnCritical = this.config.get<string>("NODE_ENV") === "production" || this.config.get("TRIVY_REQUIRED") === "true";
    const missingDigest = policy.some((f) => f.code === "MISSING_DIGEST");
    if (missingDigest || (scanCriticalCount > 0 && failOnCritical)) {
      throw new BadRequestException(
        `Image scan failed: ${scanCriticalCount} critical finding(s). Refusing to ship this image.`,
      );
    }

    await onLog(`Signed digest ${digest.slice(0, 19)}… (${scanCriticalCount} critical / ${scanHighCount} high)`);
    return {
      tag: imageTag,
      digest,
      signature,
      scanStatus: scanCriticalCount > 0 ? "FAILED" : "PASSED",
      scanCriticalCount,
      scanHighCount,
    };
  }

  private async runTrivy(imageTag: string, onLog: BuildLogger): Promise<{ critical: number; high: number }> {
    const required = this.config.get("TRIVY_REQUIRED") === "true" || this.config.get<string>("NODE_ENV") === "production";
    try {
      await onLog("Scanning image with Trivy for CRITICAL/HIGH CVEs");
      const json = await this.run(
        "docker",
        [
          "run",
          "--rm",
          "-v",
          "/var/run/docker.sock:/var/run/docker.sock",
          "aquasec/trivy:0.56.2",
          "image",
          "--quiet",
          "--scanners",
          "vuln",
          "--severity",
          "CRITICAL,HIGH",
          "--format",
          "json",
          imageTag,
        ],
        onLog,
      );
      return parseTrivyCriticalCount(json);
    } catch (err) {
      const message = (err as Error).message;
      await onLog(`Trivy scan unavailable: ${message}`);
      if (required) throw new BadRequestException(`Image scanner required in this environment: ${message}`);
      return { critical: 0, high: 0 };
    }
  }

  private run(command: string, args: string[], onLog: BuildLogger): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { env: { ...process.env, DOCKER_BUILDKIT: "1" } });
      let stdout = "";
      let stderr = "";
      const pipe = (chunk: Buffer) => {
        for (const line of chunk.toString("utf8").split("\n")) {
          if (line.trim()) void onLog(line);
        }
      };
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        pipe(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
        pipe(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr.trim() || `${command} ${args.join(" ")} exited with code ${code}`));
      });
    });
  }
}
