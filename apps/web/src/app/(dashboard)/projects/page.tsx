"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Plus, Cpu, MemoryStick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useProjects } from "@/hooks/use-projects";
import { formatRelativeTime } from "@/lib/utils";

export default function ProjectsPage() {
  const { active } = useActiveOrganization();
  const { data: projects, isLoading } = useProjects(active?.id ?? null);
  const [query, setQuery] = useState("");

  const filtered = (projects ?? []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Every application deployed in {active?.name ?? "this workspace"}.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="h-4 w-4" /> New Project
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search projects..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="No Projects Yet"
              description="Connect GitHub and deploy your first application."
              action={{ label: "Create Project", href: "/projects/new", icon: Plus }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const totalCpu = project.services.length;
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.repository?.fullName ?? "No repository"}</p>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="truncate text-xs text-primary">{project.productionUrl ?? "Not deployed yet"}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Cpu className="h-3.5 w-3.5" /> {totalCpu} services
                      </span>
                      <span className="flex items-center gap-1">
                        <MemoryStick className="h-3.5 w-3.5" /> {project.region}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Updated {formatRelativeTime(project.updatedAt)}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
