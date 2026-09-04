import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import crypto from "node:crypto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { GithubService } from "./github.service";
import { GithubOAuthService } from "./github-oauth.service";
import { GithubApiService } from "./github-api.service";
import { ImportRepositoryDto } from "./dto/import-repository.dto";
import { ConfigService } from "@nestjs/config";

@ApiTags("github")
@Controller({ path: "github", version: "1" })
export class GithubController {
  constructor(
    private readonly githubService: GithubService,
    private readonly githubOAuth: GithubOAuthService,
    private readonly githubApi: GithubApiService,
    private readonly config: ConfigService,
  ) {}

  @Get("connect")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "Get the GitHub OAuth authorize URL to redirect the user to" })
  connect(@Query("organizationId") organizationId: string, @CurrentUser() user: RequestUser) {
    const state = this.githubOAuth.signState({ organizationId, userId: user.id });
    return { url: this.githubOAuth.buildAuthorizeUrl(state) };
  }

  @Get("callback")
  @ApiOperation({ summary: "GitHub OAuth callback (public — GitHub redirects the browser here directly)" })
  async callback(@Query("code") code: string, @Query("state") state: string, @Res() res: Response) {
    const webAppUrl = this.config.get<string>("WEB_APP_URL") ?? "http://localhost:3000";
    try {
      const { organizationId, userId } = this.githubOAuth.verifyState(state);
      const token = await this.githubOAuth.exchangeCodeForToken(code);
      const githubUser = await this.githubOAuth.fetchGithubUser(token.access_token);
      await this.githubService.upsertConnection(organizationId, userId, token.access_token, githubUser.login);
      res.redirect(`${webAppUrl}/projects/new/import?connected=1`);
    } catch (err) {
      res.redirect(`${webAppUrl}/projects/new/import?error=${encodeURIComponent((err as Error).message)}`);
    }
  }

  @Get("connections")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "List GitHub connections for a workspace" })
  connections(@Query("organizationId") organizationId: string) {
    return this.githubService.listConnections(organizationId);
  }

  @Get("repositories")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "List repositories accessible to a connection" })
  repositories(@Query("connectionId") connectionId: string) {
    return this.githubService.listRepositories(connectionId);
  }

  @Get("detect")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "Detect the frontend/backend/database/redis stack in a repository" })
  detect(
    @Query("connectionId") connectionId: string,
    @Query("owner") owner: string,
    @Query("repo") repo: string,
    @Query("branch") branch?: string,
  ) {
    return this.githubService.detectStack(connectionId, owner, repo, branch);
  }

  @Get("public-detect")
  @ApiOperation({ summary: "Detect the stack of any public repository, no connection required (useful for demos)" })
  publicDetect(@Query("owner") owner: string, @Query("repo") repo: string, @Query("branch") branch?: string) {
    return this.githubApi.getRepoInfo(owner, repo).then((info) => this.githubApi.detectStack(owner, repo, branch ?? info.defaultBranch));
  }

  @Post("import")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "Link a GitHub repository to a project" })
  import(@Body() dto: ImportRepositoryDto) {
    return this.githubService.importRepository(dto.projectId, dto.connectionId, dto.fullName, dto.branch);
  }

  @Post("webhook")
  @ApiOperation({ summary: "GitHub webhook receiver (signature-verified, no auth guard)" })
  async webhook(@Req() req: Request, @Headers("x-hub-signature-256") signature: string, @Headers("x-github-event") event: string) {
    const webhookSecret = this.config.get<string>("GITHUB_WEBHOOK_SECRET");
    if (!webhookSecret) throw new BadRequestException("GitHub webhooks are not configured on this server");

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) throw new BadRequestException("Missing raw request body");

    const expected = "sha256=" + crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    const validSignature =
      signature?.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!validSignature) throw new BadRequestException("Invalid webhook signature");

    if (event !== "push") return { handled: false, reason: `ignored event type "${event}"` };
    return this.githubService.handlePushEvent(JSON.parse(rawBody.toString("utf8")));
  }
}
