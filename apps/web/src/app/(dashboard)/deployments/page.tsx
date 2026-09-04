"use client";

import Link from "next/link";
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
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="p-4 font-medium">Project</th>
                  <th className="p-4 font-medium">Branch</th>
                  <th className="p-4 font-medium">Commit</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="p-4">
                      <Link href={`/projects/${d.projectId}/deployments/${d.id}`} className="font-medium hover:text-primary">{d.projectName}</Link>
                    </td>
                    <td className="p-4 text-muted-foreground">{d.branch}</td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">{d.commitSha ?? "—"}</td>
                    <td className="p-4"><StatusBadge status={d.status} /></td>
                    <td className="p-4 text-muted-foreground">{formatRelativeTime(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
