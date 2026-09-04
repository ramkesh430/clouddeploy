import { Module } from "@nestjs/common";
import { GithubController } from "./github.controller";
import { GithubService } from "./github.service";
import { GithubOAuthService } from "./github-oauth.service";
import { GithubApiService } from "./github-api.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DeploymentsModule } from "../deployments/deployments.module";

@Module({
  imports: [DeploymentsModule],
  controllers: [GithubController],
  providers: [GithubService, GithubOAuthService, GithubApiService, RolesGuard],
  exports: [GithubService],
})
export class GithubModule {}
