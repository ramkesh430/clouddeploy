import { createHmac, timingSafeEqual } from "node:crypto";

export const CONTAINER_ID_LABEL = "com.clouddeploy.container-id";
export const SERVICE_ID_LABEL = "com.clouddeploy.service-id";
export const PROJECT_ID_LABEL = "com.clouddeploy.project-id";

const BASE_IMAGE: Record<string, string> = {
  NODE: "node:20-alpine",
  BUN: "oven/bun:1",
};

export interface SandboxRunOptions {
  name: string;
  image: string;
  cpuCores: number;
  ramMb: number;
  env: Record<string, string>;
  port?: number | null;
  network: string;
  platformContainerId: string;
  serviceId: string;
  projectId: string;
  readOnlyRoot?: boolean;
}

/** Docker CLI args for a hardened, labeled tenant container. The image
 * should be a digest (`sha256:…` or `name@sha256:…`) so we run exactly the
 * scanned/signed bytes, not a tag that can be retagged under us. */
export function dockerRunArgs(opts: SandboxRunOptions): string[] {
  const args = [
    "run",
    "-d",
    "--name",
    opts.name,
    "--network",
    opts.network,
    "--cpus",
    String(opts.cpuCores),
    "--memory",
    `${opts.ramMb}m`,
    "--memory-swap",
    `${opts.ramMb}m`,
    "--pids-limit",
    "256",
    "--security-opt",
    "no-new-privileges:true",
    "--cap-drop",
    "ALL",
    "--label",
    `${CONTAINER_ID_LABEL}=${opts.platformContainerId}`,
    "--label",
    `${SERVICE_ID_LABEL}=${opts.serviceId}`,
    "--label",
    `${PROJECT_ID_LABEL}=${opts.projectId}`,
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
  ];
  if (opts.readOnlyRoot) {
    args.push("--read-only", "--tmpfs", "/app/tmp:rw,noexec,nosuid,size=64m");
  }
  for (const [key, value] of Object.entries(opts.env)) args.push("-e", `${key}=${value}`);
  if (opts.port) args.push("-p", `0:${opts.port}`);
  args.push(opts.image);
  return args;
}

export function dockerBuildArgs(dockerfilePath: string, imageTag: string, context: string): string[] {
  return ["build", "--pull", "--network=default", "-f", dockerfilePath, "-t", imageTag, context];
}

/** Multi-stage-ish generated Dockerfile that never leaves the process
 * running as root. Used for Node/Bun services that didn't ship their own. */
export function generateRuntimeDockerfile(runtime: string, installCommand: string, startCommand: string, buildCommand?: string | null, port?: number | null): string {
  const base = BASE_IMAGE[runtime] ?? BASE_IMAGE.NODE;
  const lines = [
    `FROM ${base}`,
    "WORKDIR /app",
    "COPY --chown=node:node . .",
    "USER node",
    `RUN ${installCommand}`,
  ];
  if (buildCommand) lines.push(`RUN ${buildCommand}`);
  if (port) lines.push(`EXPOSE ${port}`);
  lines.push(`CMD ["sh", "-c", ${JSON.stringify(startCommand)}]`);
  return lines.join("\n") + "\n";
}

export function signImageDigest(digest: string, key: string): string {
  return createHmac("sha256", key).update(digest).digest("hex");
}

export function verifyImageSignature(digest: string, signature: string, key: string): boolean {
  const expected = signImageDigest(digest, key);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export interface ImagePolicyFinding {
  severity: "CRITICAL" | "HIGH";
  code: string;
  message: string;
}

/** Local, always-on policy scan — no extra binary. Complements Trivy. */
export function evaluateImagePolicy(info: { user: string; digest: string }): ImagePolicyFinding[] {
  const findings: ImagePolicyFinding[] = [];
  const user = (info.user || "").trim();
  if (!user || user === "root" || user === "0" || user.startsWith("0:")) {
    findings.push({
      severity: "CRITICAL",
      code: "RUNS_AS_ROOT",
      message: `Image is configured to run as "${user || "root"}". Untrusted workloads must run as a non-root USER.`,
    });
  }
  if (!info.digest.startsWith("sha256:") || info.digest.length < 15) {
    findings.push({
      severity: "CRITICAL",
      code: "MISSING_DIGEST",
      message: "Image has no sha256 digest — refusing to run an unsigned/unpinned tag.",
    });
  }
  return findings;
}

export function parseTrivyCriticalCount(reportJson: string): { critical: number; high: number } {
  try {
    const report = JSON.parse(reportJson) as { Results?: Array<{ Vulnerabilities?: Array<{ Severity?: string }> }> };
    let critical = 0;
    let high = 0;
    for (const result of report.Results ?? []) {
      for (const vuln of result.Vulnerabilities ?? []) {
        if (vuln.Severity === "CRITICAL") critical += 1;
        else if (vuln.Severity === "HIGH") high += 1;
      }
    }
    return { critical, high };
  } catch {
    return { critical: 0, high: 0 };
  }
}

export function traefikTlsRouterSnapshot(opts: {
  key: string;
  hostname: string;
  backendUrl: string;
  certResolver?: string;
}) {
  const certResolver = opts.certResolver ?? "letsencrypt";
  return {
    http: {
      routers: {
        [opts.key]: {
          rule: `Host(\`${opts.hostname}\`)`,
          service: opts.key,
          entryPoints: ["web", "websecure"],
          tls: { certResolver },
        },
      },
      services: {
        [opts.key]: {
          loadBalancer: {
            servers: [{ url: opts.backendUrl }],
          },
        },
      },
    },
  };
}
