"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { ExternalLink, RotateCw, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/use-projects";
import { useCreateDeployment } from "@/hooks/use-deployments";
import { cn, formatRelativeTime } from "@/lib/utils";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/services", label: "Services" },
  { href: "/deployments", label: "Deployments" },
  { href: "/environment", label: "Environment" },
  { href: "/domains", label: "Domains" },
  { href: "/logs", label: "Logs" },
  { href: "/settings", label: "Settings" },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const { data: project, isLoading } = useProject(params.projectId);
  const createDeployment = useCreateDeployment();

  const basePath = `/projects/${params.projectId}`;

  if (isLoading || !project) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const p = project as any;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{p.name}</h1>
            <StatusBadge status={p.status} />
          </div>
          <div className="flex items-center gap-2">
            {p.productionUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={p.productionUrl.startsWith("http") ? p.productionUrl : `https://${p.productionUrl}`} target="_blank" rel="noreferrer">
                  Open App <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            <Button size="sm" loading={createDeployment.isPending} onClick={() => createDeployment.mutate({ projectId: p.id })}>
              <RotateCw className="h-3.5 w-3.5" /> Redeploy
            </Button>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {p.productionUrl && <span>{p.productionUrl}</span>}
          {p.repository?.fullName && <span>{p.repository.fullName}</span>}
          <span>{p.repository?.defaultBranch ?? "main"}</span>
          <span>{p.region}</span>
          {p.deployments?.[0] && <span>Last deploy {formatRelativeTime(p.deployments[0].createdAt)}</span>}
        </div>
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const href = `${basePath}${tab.href}`;
            const active = pathname === href;
            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
