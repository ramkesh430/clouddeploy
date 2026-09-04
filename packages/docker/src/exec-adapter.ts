import { spawn } from "node:child_process";

export interface ExecResult {
  stdout: Buffer;
  stderr: string;
  exitCode: number;
}

/**
 * Runs a command inside a running Docker container via `docker exec`.
 *
 * This is the local-development stand-in for the real build-worker/
 * database-node adapters described in the platform architecture (section
 * 141 of the product spec: "use infrastructure adapter interfaces where
 * real Docker/server functionality cannot execute locally"). In production
 * this same interface would shell out to `pg_dump`/`psql` directly on the
 * database node rather than through `docker exec` — callers only depend on
 * `execInContainer`, so swapping the implementation later doesn't touch
 * calling code.
 */
export function execInContainer(
  containerName: string,
  command: string[],
  options: { stdin?: Buffer | string } = {},
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const args = ["exec", "-i", containerName, ...command];
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });

    const stdoutChunks: Buffer[] = [];
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => reject(err));
    child.on("close", (exitCode) => {
      resolve({ stdout: Buffer.concat(stdoutChunks), stderr, exitCode: exitCode ?? 0 });
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();
  });
}
