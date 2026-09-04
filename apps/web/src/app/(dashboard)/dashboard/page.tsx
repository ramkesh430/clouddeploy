"use client";

import Link from "next/link";
import {
  FolderKanban,
  Rocket,
  Hammer,
  XCircle,
  Database,
  HardDrive,
  Gauge,
  DollarSign,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAuthStore } from "@/lib/store/auth-store";
import { useDashboardSummary, type DashboardSummary } from "@/hooks/use-dashboard";
import { formatBytes, formatCurrency, formatRelativeTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const statCards = [
  { key: "totalProjects", label: "Total Projects", icon: FolderKanban, format: (v: number) => v },
  { key: "runningServices", label: "Running Services", icon: Rocket, format: (v: number) => v },
  { key: "buildingServices", label: "Building", icon: Hammer, format: (v: number) => v },
  { key: "failedServices", label: "Failed", icon: XCircle, format: (v: number) => v },
  { key: "databases", label: "Databases", icon: Database, format: (v: number) => v },
  { key: "storageUsedMb", label: "Storage Used", icon: HardDrive, format: (v: number) => formatBytes(v * 1024 * 1024) },
  { key: "monthlyBandwidthGb", label: "Monthly Bandwidth", icon: Gauge, format: (v: number) => `${v} GB` },
  { key: "monthlyCostUsd", label: "Monthly Cost", icon: DollarSign, format: (v: number) => formatCurrency(v) },
] as const;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { active } = useActiveOrganization();
  const { data, isLoading } = useDashboardSummary(active?.id ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user?.fullName?.split(" ")[0] ?? "there"}</h1>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening across {active?.name ?? "your workspace"}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key}>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{card.label}</span>
                <card.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <span className="text-xl font-semibold">{card.format((data?.stats[card.key] ?? 0) as number)}</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent Projects</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!isLoading && data?.recentProjects.length === 0 ? (
              <EmptyState
                title="No Projects Yet"
                description="Connect GitHub and deploy your first application."
                action={{ label: "Create Project", href: "/projects/new" }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Project</th>
                      <th className="pb-2 font-medium">Stack</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Domain</th>
                      <th className="pb-2 font-medium">Last Deploy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isLoading
                      ? Array.from({ length: 3 }, () => undefined)
                      : data?.recentProjects ?? []
                    ).map((p: DashboardSummary["recentProjects"][number] | undefined, i) => (
                      <tr key={p?.id ?? i} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5">
                          {p ? (
                            <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary">
                              {p.name}
                            </Link>
                          ) : (
                            <Skeleton className="h-4 w-24" />
                          )}
                        </td>
                        <td className="py-2.5 text-muted-foreground">{p?.framework ?? "—"}</td>
                        <td className="py-2.5">{p ? <StatusBadge status={p.status} /> : <Skeleton className="h-4 w-16" />}</td>
                        <td className="py-2.5 text-muted-foreground">{p?.productionUrl ?? "—"}</td>
                        <td className="py-2.5 text-muted-foreground">
                          {p?.lastDeployAt ? formatRelativeTime(p.lastDeployAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Infrastructure Health</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Object.entries(data?.infrastructureHealth ?? { buildQueue: "operational", runtimeNodes: "operational", databases: "operational", objectStorage: "operational", ssl: "operational" }).map(
              ([key, status]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</span>
                  <span className="flex items-center gap-1.5 font-medium text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Operational
                  </span>
                </div>
              ),
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent Deployments</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/deployments">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!isLoading && data?.recentDeployments.length === 0 ? (
            <EmptyState
              title="No Deployments Yet"
              description="Deploy a project to see activity here."
              action={{ label: "Create Project", href: "/projects/new", icon: Plus }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Project</th>
                    <th className="pb-2 font-medium">Branch</th>
                    <th className="pb-2 font-medium">Commit</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentDeployments ?? []).map((d) => (
                    <tr key={d.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5">
                        <Link href={`/projects/${d.projectSlug}/deployments/${d.id}`} className="font-medium hover:text-primary">
                          {d.project}
                        </Link>
                      </td>
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">{d.branch}</td>
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">{d.commitSha?.slice(0, 7) ?? "—"}</td>
                      <td className="py-2.5">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="py-2.5 text-muted-foreground">{d.durationMs ? `${Math.round(d.durationMs / 1000)}s` : "—"}</td>
                      <td className="py-2.5 text-muted-foreground">{formatRelativeTime(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
