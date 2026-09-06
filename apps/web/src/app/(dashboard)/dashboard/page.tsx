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
  ArrowUpRight,
  Plus,
  MoreVertical,
  Settings,
  ListTree,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAuthStore } from "@/lib/store/auth-store";
import { useDashboardSummary, type DashboardSummary } from "@/hooks/use-dashboard";
import { formatBytes, formatCurrency, formatRelativeTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const statCards = [
  { key: "totalProjects", label: "Total Projects", icon: FolderKanban, color: "text-primary bg-primary/10", format: (v: number) => v },
  { key: "runningServices", label: "Running Services", icon: Rocket, color: "text-success bg-success/10", format: (v: number) => v },
  { key: "buildingServices", label: "Building", icon: Hammer, color: "text-warning bg-warning/10", format: (v: number) => v },
  { key: "failedServices", label: "Failed", icon: XCircle, color: "text-destructive bg-destructive/10", format: (v: number) => v },
  { key: "databases", label: "Databases", icon: Database, color: "text-secondary bg-secondary/10", format: (v: number) => v },
  { key: "storageUsedMb", label: "Storage Used", icon: HardDrive, color: "text-primary bg-primary/10", format: (v: number) => formatBytes(v * 1024 * 1024) },
  { key: "monthlyBandwidthGb", label: "Monthly Bandwidth", icon: Gauge, color: "text-secondary bg-secondary/10", format: (v: number) => `${v} GB` },
  { key: "monthlyCostUsd", label: "Monthly Cost", icon: DollarSign, color: "text-success bg-success/10", format: (v: number) => formatCurrency(v) },
] as const;

// A stable, decorative accent per project row — cycled by position so the
// list reads as scannable blocks of color, the same way the design mock
// distinguishes rows without tying color to project status.
const PROJECT_ACCENTS = [
  "bg-primary/10 text-primary",
  "bg-secondary/10 text-secondary",
  "bg-success/10 text-success",
  "bg-warning/10 text-warning",
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { active } = useActiveOrganization();
  const { data, isLoading } = useDashboardSummary(active?.id ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user?.fullName?.split(" ")[0] ?? "there"}</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening across {active?.name ?? "your workspace"} today.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="h-4 w-4" /> Create Project
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <span className="text-2xl font-bold tracking-tight">{card.format((data?.stats[card.key] ?? 0) as number)}</span>
              )}
              <span className="text-xs text-muted-foreground">{card.label}</span>
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
              <div className="flex flex-col">
                {(isLoading
                  ? Array.from({ length: 4 }, () => undefined)
                  : data?.recentProjects ?? []
                ).map((p: DashboardSummary["recentProjects"][number] | undefined, i) => (
                  <div
                    key={p?.id ?? i}
                    className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0"
                  >
                    {p ? (
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold ${PROJECT_ACCENTS[i % PROJECT_ACCENTS.length]}`}>
                        {p.name.slice(0, 1).toUpperCase()}
                      </div>
                    ) : (
                      <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                    )}
                    <div className="min-w-0 flex-1">
                      {p ? (
                        <Link href={`/projects/${p.id}`} className="truncate text-sm font-medium hover:text-primary">
                          {p.name}
                        </Link>
                      ) : (
                        <Skeleton className="h-4 w-28" />
                      )}
                      <p className="truncate text-xs text-muted-foreground">{p?.framework ?? " "}</p>
                    </div>
                    {p ? <StatusBadge status={p.status} /> : <Skeleton className="h-5 w-16 shrink-0" />}
                    <a
                      href={p?.productionUrl ? `https://${p.productionUrl}` : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="hidden shrink-0 items-center gap-1 text-xs text-primary hover:underline sm:flex"
                    >
                      {p?.productionUrl && (
                        <>
                          {p.productionUrl} <ArrowUpRight className="h-3 w-3" />
                        </>
                      )}
                    </a>
                    <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
                      {p?.lastDeployAt ? formatRelativeTime(p.lastDeployAt) : ""}
                    </span>
                    {p && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${p.id}`}>
                              <ListTree className="h-3.5 w-3.5" /> View project
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${p.id}/settings`}>
                              <Settings className="h-3.5 w-3.5" /> Settings
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
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
