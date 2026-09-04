import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { detectRepositoryStack } from "@clouddeploy/deployment-core";
import type { RepositoryDetectionResult } from "@clouddeploy/types";

export interface GithubRepoSummary {
  fullName: string;
  owner: string;
  name: string;
  isPrivate: boolean;
  language: string | null;
  defaultBranch: string;
  updatedAt: string;
}

interface GithubTreeEntry {
  path: string;
  type: "blob" | "tree";
}

const MANIFEST_FILENAMES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "composer.json",
  "artisan",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "go.mod",
  "Gemfile",
  "Cargo.toml",
  "Dockerfile",
  "manage.py",
];

/**
 * Thin wrapper around the GitHub REST API. Every method accepts an optional
 * access token — public repositories work fine unauthenticated (at GitHub's
 * lower unauthenticated rate limit), which is deliberate: it means
 * detection against public repos is exercisable and testable without a
 * configured OAuth app, while private-repo listing and higher rate limits
 * still require a real connection's token.
 */
@Injectable()
export class GithubApiService {
  private async request<T>(path: string, accessToken?: string): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (res.status === 404) throw new NotFoundException("Repository or resource not found on GitHub");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new BadRequestException(`GitHub API error (${res.status}): ${body.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  async listRepositories(accessToken: string): Promise<GithubRepoSummary[]> {
    const repos = await this.request<any[]>("/user/repos?per_page=100&sort=updated", accessToken);
    return repos.map((r) => ({
      fullName: r.full_name,
      owner: r.owner.login,
      name: r.name,
      isPrivate: r.private,
      language: r.language,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
    }));
  }

  async getRepoInfo(owner: string, repo: string, accessToken?: string): Promise<GithubRepoSummary> {
    const r = await this.request<any>(`/repos/${owner}/${repo}`, accessToken);
    return {
      fullName: r.full_name,
      owner: r.owner.login,
      name: r.name,
      isPrivate: r.private,
      language: r.language,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
    };
  }

  async getBranches(owner: string, repo: string, accessToken?: string): Promise<string[]> {
    const branches = await this.request<any[]>(`/repos/${owner}/${repo}/branches?per_page=100`, accessToken);
    return branches.map((b) => b.name);
  }

  private async getTree(owner: string, repo: string, branch: string, accessToken?: string): Promise<string[]> {
    const data = await this.request<{ tree: GithubTreeEntry[]; truncated: boolean }>(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      accessToken,
    );
    return data.tree.filter((e) => e.type === "blob").map((e) => e.path);
  }

  private async getFileContent(owner: string, repo: string, path: string, ref: string, accessToken?: string): Promise<string> {
    const data = await this.request<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
      accessToken,
    );
    return Buffer.from(data.content, data.encoding as BufferEncoding).toString("utf8");
  }

  async detectStack(owner: string, repo: string, branch: string, accessToken?: string): Promise<RepositoryDetectionResult> {
    const allPaths = await this.getTree(owner, repo, branch, accessToken);

    const manifestPaths = allPaths.filter((p) => {
      const name = p.includes("/") ? p.slice(p.lastIndexOf("/") + 1) : p;
      if (!MANIFEST_FILENAMES.includes(name)) return false;
      const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
      return !dir.includes("/"); // root or depth-1 only, matches detectRepositoryStack's own rule
    });

    const manifestContents: Record<string, string> = {};
    // Fetch file contents sequentially to stay well within GitHub's
    // unauthenticated rate limit when no access token is available.
    for (const path of manifestPaths) {
      const name = path.slice(path.lastIndexOf("/") + 1);
      // artisan/manage.py/Dockerfile are only checked for *existence*, not parsed.
      if (["artisan", "manage.py", "Dockerfile"].includes(name)) continue;
      try {
        manifestContents[path] = await this.getFileContent(owner, repo, path, branch, accessToken);
      } catch {
        // A manifest that fails to fetch just gets skipped — detection
        // degrades gracefully rather than failing the whole request.
      }
    }

    return detectRepositoryStack({
      repositoryFullName: `${owner}/${repo}`,
      defaultBranch: branch,
      allPaths,
      manifestContents,
    });
  }
}
