"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Cpu, MemoryStick, HardDrive, Activity, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useProject } from "@/hooks/use-projects";
import { formatRelativeTime } from "@/lib/utils";

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const { data: project } = useProject(params.projectId);
  const p = project as any;
  if (!p) return null;

  const totalRam = (p.services ?? []).reduce((sum: number, s: any) => sum + (s.ramMb ?? 0), 0);
  const services = p.services ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Services", value: services.length, icon: Activity, color: "text-primary bg-primary/10" },
          { label: "Total RAM", value: `${totalRam} MB`, icon: MemoryStick, color: "text-secondary bg-secondary/10" },
          { label: "CPU Allocated", value: `${services.reduce((s: number, x: any) => s + (x.cpuCores ?? 0), 0)} cores`, icon: Cpu, color: "text-warning bg-warning/10" },
          { label: "Storage", value: "—", icon: HardDrive, color: "text-success bg-success/10" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <span className="text-2xl font-bold tracking-tight">{c.value}</span>
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Architecture</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2 py-6">
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No services yet. Add one to see your architecture here.</p>
          ) : (
            services.map((s: any, i: number) => (
              <div key={s.id} className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm">
                  {s.name} <StatusBadge status={s.status} />
                </div>
                {i < services.length - 1 && <ArrowDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Deployments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(p.deployments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No deployments yet.</p>}
          {(p.deployments ?? []).map((d: any) => (
            <Link
              key={d.id}
              href={`/projects/${p.id}/deployments/${d.id}`}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              <span className="font-mono text-xs text-muted-foreground">{d.commitSha ?? "—"}</span>
              <span className="text-muted-foreground">{d.branch}</span>
              <StatusBadge status={d.status} />
              <span className="text-xs text-muted-foreground">{formatRelativeTime(d.createdAt)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
