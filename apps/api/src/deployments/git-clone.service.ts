import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { decryptSecretWithFallback } from "@clouddeploy/security";
import { PrismaService } from "../prisma/prisma.service";

export interface ClonedRepository {
  /** Absolute path to the cloned working tree. Caller owns cleanup — see `cleanup()`. */
  dir: string;
  commitSha: string;
}

/**
 * Clones a project's connected GitHub repository for real, using the same
 * OAuth token GithubApiService already uses for REST calls (decrypted the
 * same way GithubService.getConnectionWithToken does) — this is the first
 * time that token is used for an actual `git clone` rather than API calls.
 *
 * Deliberately reads GitProviderConnection/Repository directly via Prisma
 * instead of importing GithubModule: GithubModule already imports
 * DeploymentsModule (to trigger deploys from webhooks), so importing it
 * back here would create a module cycle.
 */
@Injectable()
export class GitCloneService {
  private readonly logger = new Logger("GitCloneService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Null if the project has no connected repository — callers use this to
   * decide whether a real deployment is even possible. */
  async getConnectedRepository(projectId: string) {
    return this.prisma.repository.findUnique({ where: { projectId } });
  }

  async cloneRepository(projectId: string, branch: string): Promise<ClonedRepository> {
    const repository = await this.getConnectedRepository(projectId);
    if (!repository) throw new NotFoundException("Project has no connected repository");

    const connection = await this.prisma.gitProviderConnection.findUnique({ where: { id: repository.connectionId } });
    if (!connection?.accessToken) throw new BadRequestException("Connected repository has no stored access token");
    const accessToken = decryptSecretWithFallback(connection.accessToken, this.config.getOrThrow("ENCRYPTION_KEY"), this.config.get("ENCRYPTION_KEY_PREVIOUS"));

    const dir = await mkdtemp(path.join(tmpdir(), "clouddeploy-build-"));
    const authedUrl = `https://x-access-token:${accessToken}@github.com/${repository.fullName}.git`;

    try {
      await this.run("git", ["clone", "--branch", branch, "--depth", "1", authedUrl, dir]);
      const commitSha = (await this.run("git", ["rev-parse", "HEAD"], dir)).trim();
      return { dir, commitSha };
    } catch (err) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
      // Strip the token out of any error text before it can reach a log line.
      const message = (err as Error).message.replaceAll(accessToken, "***");
      throw new BadRequestException(`Failed to clone ${repository.fullName}@${branch}: ${message}`);
    }
  }

  async cleanup(dir: string): Promise<void> {
    await rm(dir, { recursive: true, force: true }).catch((err) => this.logger.warn(`Failed to clean up ${dir}: ${(err as Error).message}`));
  }

  private run(command: string, args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd });
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
