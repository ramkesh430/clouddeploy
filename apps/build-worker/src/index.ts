import { Worker, Queue } from "bullmq";
import {
  dockerBuildArgs,
  evaluateImagePolicy,
  generateRuntimeDockerfile,
  parseTrivyCriticalCount,
  signImageDigest,
} from "@clouddeploy/docker";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/**
 * Dedicated builder process. Production runs this on each build node with
 * Docker (not on the API process). The API still knows how to build
 * in-process for a single-host pilot; this worker is the multi-node path:
 * it consumes the `builds` BullMQ queue and writes the same digest + HMAC
 * signature the runtime verifies before `docker run`.
 */
const env = z
  .object({
    REDIS_URL: z.string().default("redis://localhost:6382"),
    ENCRYPTION_KEY: z.string().min(32),
    QUEUE_NAME: z.string().default("builds"),
  })
  .parse(process.env);

const connection = { url: env.REDIS_URL };
const queue = new Queue(env.QUEUE_NAME, { connection });

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, DOCKER_BUILDKIT: "1" } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${command} exited ${code}`));
    });
  });
}

interface BuildJob {
  context: string;
  dockerfilePath?: string;
  runtime: string;
  installCommand?: string;
  startCommand?: string;
  buildCommand?: string | null;
  port?: number | null;
  imageTag: string;
}

async function buildJob(data: BuildJob) {
  let dockerfilePath = data.dockerfilePath ?? path.join(data.context, "Dockerfile");
  if (data.runtime !== "DOCKER") {
    dockerfilePath = path.join(data.context, ".clouddeploy.Dockerfile");
    await writeFile(
      dockerfilePath,
      generateRuntimeDockerfile(
        data.runtime,
        data.installCommand ?? "npm install",
        data.startCommand ?? "npm start",
        data.buildCommand,
        data.port,
      ),
    );
  }
  await run("docker", dockerBuildArgs(dockerfilePath, data.imageTag, data.context));
  const digest = (await run("docker", ["inspect", "--format", "{{.Id}}", data.imageTag])).trim();
  const user = (await run("docker", ["inspect", "--format", "{{.Config.User}}", data.imageTag])).trim();
  const signature = signImageDigest(digest, env.ENCRYPTION_KEY);
  const policy = evaluateImagePolicy({ user, digest });
  let trivyJson = "{}";
  try {
    trivyJson = await run("docker", [
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
      data.imageTag,
    ]);
  } catch {
    trivyJson = "{}";
  }
  const vulns = parseTrivyCriticalCount(trivyJson);
  return {
    tag: data.imageTag,
    digest,
    signature,
    policy,
    scanCriticalCount: vulns.critical + policy.filter((f) => f.severity === "CRITICAL").length,
    scanHighCount: vulns.high,
  };
}

const worker = new Worker(
  env.QUEUE_NAME,
  async (job) => {
    console.log(`[build-worker] starting ${job.id} ${job.data?.imageTag ?? ""}`);
    const result = await buildJob(job.data as BuildJob);
    console.log(`[build-worker] signed ${result.digest.slice(0, 19)}…`);
    return result;
  },
  { connection, concurrency: 1 },
);

worker.on("failed", (job, err) => {
  console.error(`[build-worker] job ${job?.id} failed: ${err.message}`);
});

console.log(`[build-worker] listening on queue "${env.QUEUE_NAME}" via ${env.REDIS_URL}`);

process.on("SIGINT", async () => {
  await worker.close();
  await queue.close();
  process.exit(0);
});
