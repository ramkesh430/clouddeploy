import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { encryptSecret, decryptSecret } from "@clouddeploy/security";
import { PrismaService } from "../prisma/prisma.service";
import { DeploymentsService } from "../deployments/deployments.service";
import { GithubApiService } from "./github-api.service";

@Injectable()
export class GithubService {
  private readonly logger = new Logger("GithubService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly githubApi: GithubApiService,
    private readonly deploymentsService: DeploymentsService,
  ) {}

  async upsertConnection(organizationId: string, userId: string, accessToken: string, providerLogin: string) {
    return this.prisma.gitProviderConnection.upsert({
      where: { organizationId_provider_providerLogin: { organizationId, provider: "GITHUB", providerLogin } },
      create: {
        organizationId,
        userId,
        provider: "GITHUB",
        providerLogin,
        accessToken: encryptSecret(accessToken, this.config.getOrThrow("ENCRYPTION_KEY")),
      },
      update: {
        userId,
        accessToken: encryptSecret(accessToken, this.config.getOrThrow("ENCRYPTION_KEY")),
      },
    });
  }

  async listConnections(organizationId: string) {
    const rows = await this.prisma.gitProviderConnection.findMany({ where: { organizationId } });
    return rows.map(({ accessToken, refreshToken, ...rest }) => rest);
  }

  private async getConnectionWithToken(connectionId: string) {
    const connection = await this.prisma.gitProviderConnection.findUnique({ where: { id: connectionId } });
    if (!connection) throw new NotFoundException("GitHub connection not found");
    if (!connection.accessToken) throw new BadRequestException("This connection has no stored access token");
    return { connection, accessToken: decryptSecret(connection.accessToken, this.config.getOrThrow("ENCRYPTION_KEY")) };
  }

  async listRepositories(connectionId: string) {
    const { accessToken } = await this.getConnectionWithToken(connectionId);
    return this.githubApi.listRepositories(accessToken);
  }

  async detectStack(connectionId: string, owner: string, repo: string, branch?: string) {
    const { accessToken } = await this.getConnectionWithToken(connectionId);
    const resolvedBranch = branch ?? (await this.githubApi.getRepoInfo(owner, repo, accessToken)).defaultBranch;
    return this.githubApi.detectStack(owner, repo, resolvedBranch, accessToken);
  }

  async importRepository(projectId: string, connectionId: string, fullName: string, branch?: string) {
    const { connection, accessToken } = await this.getConnectionWithToken(connectionId);
    const [owner, repo] = fullName.split("/");
    if (!owner || !repo) throw new BadRequestException("Repository must be in owner/name format");

    const repoInfo = await this.githubApi.getRepoInfo(owner, repo, accessToken);
    const defaultBranch = branch ?? repoInfo.defaultBranch;

    const webhook = await this.installWebhook(owner, repo, accessToken).catch((err) => {
      this.logger.warn(`Could not install webhook for ${fullName}: ${err.message}`);
      return null;
    });

    return this.prisma.repository.upsert({
      where: { projectId },
      create: {
        projectId,
        connectionId: connection.id,
        fullName,
        provider: "GITHUB",
        defaultBranch,
        isPrivate: repoInfo.isPrivate,
        webhookId: webhook?.id ? String(webhook.id) : null,
      },
      update: {
        connectionId: connection.id,
        fullName,
        defaultBranch,
        isPrivate: repoInfo.isPrivate,
        webhookId: webhook?.id ? String(webhook.id) : null,
      },
    });
  }

  private async installWebhook(owner: string, repo: string, accessToken: string): Promise<{ id: number } | null> {
    const webhookSecret = this.config.get<string>("GITHUB_WEBHOOK_SECRET");
    if (!webhookSecret) return null;

    const apiUrl = this.config.get<string>("API_URL") ?? "http://localhost:4000";
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["push"],
        config: { url: `${apiUrl}/api/v1/github/webhook`, content_type: "json", secret: webhookSecret },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<{ id: number }>;
  }

  /** Handles a validated `push` webhook payload — the entry point for auto-deploy (spec section 97). */
  async handlePushEvent(payload: { ref: string; repository: { full_name: string }; head_commit?: { id: string; message: string } }) {
    const repository = await this.prisma.repository.findFirst({
      where: { fullName: payload.repository.full_name },
      include: { project: true },
    });
    if (!repository) {
      this.logger.warn(`Push event for unlinked repository ${payload.repository.full_name}`);
      return { deployed: false, reason: "repository not linked" };
    }

    const pushedBranch = payload.ref.replace("refs/heads/", "");
    if (pushedBranch !== repository.defaultBranch) {
      return { deployed: false, reason: `push to ${pushedBranch}, not the default branch (${repository.defaultBranch})` };
    }

    const deployment = await this.deploymentsService.create(
      { projectId: repository.projectId, branch: pushedBranch },
      repository.project.createdBy ?? undefined,
      true,
      payload.head_commit ? { sha: payload.head_commit.id.slice(0, 7), message: payload.head_commit.message } : undefined,
    );
    this.logger.log(`Auto-deploy triggered for ${payload.repository.full_name}@${pushedBranch} -> deployment ${deployment.id}`);
    return { deployed: true, deploymentId: deployment.id };
  }
}
