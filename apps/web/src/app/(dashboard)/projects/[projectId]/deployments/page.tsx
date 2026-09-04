"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useDeployments } from "@/hooks/use-deployments";
import { formatRelativeTime } from "@/lib/utils";

export default function ProjectDeploymentsPage() {
  const params = useParams<{ projectId: string }>();
  const { data: deployments } = useDeployments(params.projectId);

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-4 font-medium">Deployment</th>
              <th className="p-4 font-medium">Branch</th>
              <th className="p-4 font-medium">Commit</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Duration</th>
              <th className="p-4 font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {(deployments ?? []).map((d) => (
              <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                <td className="p-4">
                  <Link href={`/projects/${params.projectId}/deployments/${d.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                    #{d.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="p-4 text-muted-foreground">{d.branch}</td>
                <td className="p-4 font-mono text-xs text-muted-foreground">{d.commitSha ?? "—"}</td>
                <td className="p-4"><StatusBadge status={d.status} /></td>
                <td className="p-4 text-muted-foreground">{d.durationMs ? `${Math.round(d.durationMs / 1000)}s` : "—"}</td>
                <td className="p-4 text-muted-foreground">{formatRelativeTime(d.createdAt)}</td>
              </tr>
            ))}
            {(deployments ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  No deployments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
