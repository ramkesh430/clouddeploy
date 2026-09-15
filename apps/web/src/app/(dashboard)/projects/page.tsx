"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useProjects } from "@/hooks/use-projects";
import { formatRelativeTime } from "@/lib/utils";

const PAGE_SIZE = 8;

const STATUS_TABS = [
  { value: "all", label: "All Projects" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["value"];

export default function ProjectsPage() {
  const { active } = useActiveOrganization();
  const { data: projects, isLoading } = useProjects(active?.id ?? null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      (projects ?? []).filter(
        (p) =>
          (status === "all" || p.status === status) && p.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [projects, status, query],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage all your projects across {active?.name ?? "this workspace"}.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="h-4 w-4" /> New Project
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as StatusFilter);
            setPage(1);
          }}
        >
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title={projects && projects.length > 0 ? "No matching projects" : "No Projects Yet"}
              description={
                projects && projects.length > 0
                  ? "Try a different search or status filter."
                  : "Connect GitHub and deploy your first application."
              }
              action={{ label: "Create Project", href: "/projects/new", icon: Plus }}
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
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Services</th>
                    <th className="px-5 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((project) => (
                    <tr
                      key={project.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-5 py-3">
                        <Link href={`/projects/${project.id}`} className="block">
                          <p className="font-medium hover:text-primary">{project.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {project.productionUrl
                              ?? (project.domainMessage
                                ? `${project.assignedHostname ?? ""} ${project.domainMessage}`.trim()
                                : project.repository?.fullName ?? "Not deployed yet")}
                          </p>
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{project._count.services}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatRelativeTime(project.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {totalPages <= 7 ? (
                    Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                      <Button
                        key={n}
                        variant={n === currentPage ? "secondary" : "ghost"}
                        size="icon"
                        className="h-7 w-7 text-xs"
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </Button>
                    ))
                  ) : (
                    <span className="px-2 text-xs text-muted-foreground">{currentPage}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
