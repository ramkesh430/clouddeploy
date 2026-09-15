"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useProjects } from "@/hooks/use-projects";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";
import { formatRelativeTime } from "@/lib/utils";

interface DeploymentRow {
  id: string;
  branch: string;
  commitSha: string | null;
  status: string;
  durationMs: number | null;
  createdAt: string;
  projectName: string;
  projectId: string;
}

export default function AllDeploymentsPage() {
  const { active } = useActiveOrganization();
  const { data: projects } = useProjects(active?.id ?? null);
  const [query, setQuery] = useState("");

  const { data: deploymentsByProject, isLoading } = useQuery({
    queryKey: ["all-deployments", (projects ?? []).map((p) => p.id)],
    queryFn: async () => {
      const results = await Promise.all(
        (projects ?? []).map(async (p) => ({
          project: p,
          deployments: await api.get<DeploymentRow[]>(`/deployments?projectId=${p.id}`),
        })),
      );
      return results.flatMap((r) =>
        r.deployments.map((d) => ({ ...d, projectName: r.project.name, projectId: r.project.id })),
      );
    },
    enabled: !!projects && projects.length > 0,
  });

  const deployments = useMemo(
    () =>
      (deploymentsByProject ?? []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [deploymentsByProject],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return deployments;
    return deployments.filter(
      (d) =>
        d.projectName.toLowerCase().includes(q) ||
        d.branch.toLowerCase().includes(q) ||
        (d.commitSha ?? "").toLowerCase().includes(q),
    );
  }, [deployments, query]);

  const loading = isLoading || (!!projects && projects.length > 0 && !deploymentsByProject);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>
          <p className="text-sm text-muted-foreground">
            Deployment history and status across {active?.name ?? "this workspace"}.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search deployments..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title={deployments.length > 0 ? "No matching deployments" : "No Deployments Yet"}
              description={
                deployments.length > 0 ? "Try a different search." : "Deploy a project to see activity here."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">ID</th>
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Branch</th>
                    <th className="px-5 py-3 font-medium">Commit</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Duration</th>
                    <th className="px-5 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <Link
                          href={`/projects/${d.projectId}/deployments/${d.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          #{d.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/projects/${d.projectId}`} className="font-medium hover:text-primary">
                          {d.projectName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{d.branch}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                        {d.commitSha?.slice(0, 7) ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {d.durationMs ? `${Math.round(d.durationMs / 1000)}s` : "—"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{formatRelativeTime(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
