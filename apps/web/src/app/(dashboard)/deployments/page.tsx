"use client";

import Link from "next/link";
import { Rocket } from "lucide-react";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useProjects } from "@/hooks/use-projects";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

export default function AllDeploymentsPage() {
  const { active } = useActiveOrganization();
  const { data: projects } = useProjects(active?.id ?? null);

  const { data: deploymentsByProject } = useQuery({
    queryKey: ["all-deployments", (projects ?? []).map((p) => p.id)],
    queryFn: async () => {
      const results = await Promise.all(
        (projects ?? []).map(async (p) => ({
          project: p,
          deployments: await api.get<any[]>(`/deployments?projectId=${p.id}`),
        })),
      );
      return results.flatMap((r) => r.deployments.map((d) => ({ ...d, projectName: r.project.name, projectId: r.project.id })));
    },
    enabled: !!projects && projects.length > 0,
  });

  const deployments = (deploymentsByProject ?? []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>
        <p className="text-sm text-muted-foreground">Every deployment across all projects in {active?.name ?? "this workspace"}.</p>
      </div>
      {deployments.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState title="No Deployments Yet" description="Deploy a project to see activity here." /></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col p-0">
            {deployments.map((d) => (
              <Link
                key={d.id}
                href={`/projects/${d.projectId}/deployments/${d.id}`}
                className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0 hover:bg-accent/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Rocket className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.projectName}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.branch} · {d.commitSha?.slice(0, 7) ?? "—"}</p>
                </div>
                <StatusBadge status={d.status} />
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{formatRelativeTime(d.createdAt)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
