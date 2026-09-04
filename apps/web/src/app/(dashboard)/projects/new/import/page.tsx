"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Github, ArrowLeft, Search, Lock, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useGithubConnections, useConnectGithub, useGithubRepositories } from "@/hooks/use-github";
import { toast } from "@/lib/store/toast-store";
import { formatRelativeTime } from "@/lib/utils";

export default function ImportGithubPage() {
  return (
    <Suspense fallback={null}>
      <ImportGithubContent />
    </Suspense>
  );
}

function ImportGithubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { active } = useActiveOrganization();
  const { data: connections, isLoading: connectionsLoading } = useGithubConnections(active?.id ?? null);
  const connectGithub = useConnectGithub();
  const [query, setQuery] = useState("");
  const [publicRepoUrl, setPublicRepoUrl] = useState("");

  const connection = connections?.[0] ?? null;
  const { data: repos, isLoading: reposLoading } = useGithubRepositories(connection?.id ?? null);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) toast({ title: "GitHub connection failed", description: error, variant: "destructive" });
    if (searchParams.get("connected")) toast({ title: "GitHub connected", variant: "success" });
  }, [searchParams]);

  const filteredRepos = (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(query.toLowerCase()));

  const importPublicRepo = () => {
    const match = publicRepoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/) ?? publicRepoUrl.match(/^([^/]+)\/([^/\s]+)$/);
    if (!match) {
      toast({ title: "Enter a GitHub URL or owner/repo", variant: "destructive" });
      return;
    }
    const [, owner, repo] = match;
    router.push(`/projects/new/empty?publicOwner=${owner}&publicRepo=${repo}`);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/projects/new">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </Button>

      {!connectionsLoading && !connection && (
        <>
          <Card>
            <CardHeader className="items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Github className="h-6 w-6" />
              </div>
              <CardTitle>Connect GitHub</CardTitle>
              <CardDescription>Authorize CloudDeploy to read your repositories and deploy them automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" loading={connectGithub.isPending} onClick={() => active && connectGithub.mutate(active.id)}>
                <Github className="h-4 w-4" /> Connect GitHub
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Deploy a public repository</CardTitle>
              <CardDescription>No GitHub connection needed for public repos.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                placeholder="github.com/vercel/next-learn or owner/repo"
                value={publicRepoUrl}
                onChange={(e) => setPublicRepoUrl(e.target.value)}
              />
              <Button variant="outline" onClick={importPublicRepo}>
                Detect <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {connection && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search repositories..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {reposLoading && <p className="text-sm text-muted-foreground">Loading repositories...</p>}

          <div className="flex flex-col gap-2">
            {filteredRepos.map((repo) => (
              <Card key={repo.fullName}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {repo.isPrivate ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Globe className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">{repo.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {repo.language ?? "Unknown"} · Updated {formatRelativeTime(repo.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/projects/new/empty?connectionId=${connection.id}&owner=${repo.owner}&repo=${repo.name}&branch=${repo.defaultBranch}`,
                      )
                    }
                  >
                    Import
                  </Button>
                </CardContent>
              </Card>
            ))}
            {!reposLoading && filteredRepos.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No repositories found.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
