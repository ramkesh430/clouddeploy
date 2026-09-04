import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import crypto from "node:crypto";

export interface GithubOAuthState {
  organizationId: string;
  userId: string;
  exp: number;
}

export interface GithubTokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
}

export interface GithubUser {
  id: number;
  login: string;
  avatar_url: string;
}

/**
 * GitHub's standard OAuth Authorization Code flow (see section 96 of the
 * product spec). The `state` param is a signed, short-lived payload — not a
 * DB-backed session — since the browser navigates directly from GitHub to
 * our public callback with no bearer token available; the signature is
 * what prevents a forged callback from attaching a connection to the wrong
 * organization.
 */
@Injectable()
export class GithubOAuthService {
  constructor(private readonly config: ConfigService) {}

  private isConfigured(): boolean {
    return Boolean(this.config.get<string>("GITHUB_CLIENT_ID")) && Boolean(this.config.get<string>("GITHUB_CLIENT_SECRET"));
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "GitHub integration is not configured in this environment — set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable it.",
      );
    }
  }

  signState(payload: Omit<GithubOAuthState, "exp">): string {
    const state: GithubOAuthState = { ...payload, exp: Date.now() + 10 * 60 * 1000 };
    const body = Buffer.from(JSON.stringify(state)).toString("base64url");
    const signature = this.sign(body);
    return `${body}.${signature}`;
  }

  verifyState(state: string): GithubOAuthState {
    const [body, signature] = state.split(".");
    if (!body || !signature || this.sign(body) !== signature) {
      throw new BadRequestException("Invalid or tampered OAuth state");
    }
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GithubOAuthState;
    if (parsed.exp < Date.now()) {
      throw new BadRequestException("This GitHub connection attempt expired — try again");
    }
    return parsed;
  }

  buildAuthorizeUrl(state: string): string {
    this.assertConfigured();
    const clientId = this.config.getOrThrow<string>("GITHUB_CLIENT_ID");
    const apiUrl = this.config.get<string>("API_URL") ?? "http://localhost:4000";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${apiUrl}/api/v1/github/callback`,
      scope: "repo read:user",
      state,
      allow_signup: "true",
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<GithubTokenResponse> {
    this.assertConfigured();
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: this.config.getOrThrow<string>("GITHUB_CLIENT_ID"),
        client_secret: this.config.getOrThrow<string>("GITHUB_CLIENT_SECRET"),
        code,
      }),
    });
    const json = (await res.json()) as GithubTokenResponse & { error?: string; error_description?: string };
    if (!res.ok || json.error) {
      throw new BadRequestException(json.error_description ?? "Failed to exchange GitHub authorization code");
    }
    return json;
  }

  async fetchGithubUser(accessToken: string): Promise<GithubUser> {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new BadRequestException("Failed to fetch GitHub user profile");
    return res.json() as Promise<GithubUser>;
  }

  private sign(value: string): string {
    const secret = this.config.get<string>("COOKIE_SECRET") ?? "dev-only-fallback-signing-secret";
    return crypto.createHmac("sha256", secret).update(value).digest("base64url");
  }
}
