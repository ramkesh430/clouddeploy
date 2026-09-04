"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useDeployments, useRollback } from "@/hooks/use-deployments";
import { formatRelativeTime } from "@/lib/utils";

export default function ProjectDeploymentsPage() {
  const params = useParams<{ projectId: string }>();
  const { data: deployments } = useDeployments(params.projectId);
  const rollback = useRollback();
  const [rollbackTarget, setRollbackTarget] = useState<{ id: string; label: string } | null>(null);

  const currentLive = deployments?.find((d) => d.status === "LIVE");

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-4 font-medium">Deployment</th>
              <th className="p-4 font-medium">Branch</th>
              <th className="p-4 font-medium">Commit</th>
              <th className="p-4 font-medium">Environment</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Duration</th>
              <th className="p-4 font-medium">Started</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(deployments ?? []).map((d) => {
              const isCurrent = currentLive?.id === d.id;
              const canRollbackTo = !isCurrent && d.status === "LIVE" && currentLive;
              return (
                <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                  <td className="p-4">
                    <Link href={`/projects/${params.projectId}/deployments/${d.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                      #{d.id.slice(0, 8)}
                    </Link>
                    {isCurrent && <Badge variant="success" className="ml-2">Current</Badge>}
                  </td>
                  <td className="p-4 text-muted-foreground">{d.branch}</td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">{d.commitSha ?? "—"}</td>
                  <td className="p-4 text-muted-foreground">{d.environment === "PREVIEW" ? "Preview" : "Production"}</td>
                  <td className="p-4"><StatusBadge status={d.status} /></td>
                  <td className="p-4 text-muted-foreground">{d.durationMs ? `${Math.round(d.durationMs / 1000)}s` : "—"}</td>
                  <td className="p-4 text-muted-foreground">{formatRelativeTime(d.createdAt)}</td>
                  <td className="p-4">
                    {canRollbackTo && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRollbackTarget({ id: d.id, label: `#${d.id.slice(0, 8)}` })}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Rollback
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {(deployments ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                  No deployments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>

      <Dialog open={!!rollbackTarget} onOpenChange={(v) => !v && setRollbackTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roll back to {rollbackTarget?.label}?</DialogTitle>
            <DialogDescription>
              Traffic will be re-routed to a fresh deployment of this earlier, healthy version. The current deployment will be marked rolled back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={rollback.isPending}
              onClick={() =>
                currentLive &&
                rollbackTarget &&
                rollback.mutate(
                  { deploymentId: currentLive.id, targetDeploymentId: rollbackTarget.id },
                  { onSuccess: () => setRollbackTarget(null) },
                )
              }
            >
              Confirm Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
