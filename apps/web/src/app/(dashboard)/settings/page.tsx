"use client";

import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useActivityLog } from "@/hooks/use-organizations";
import { formatRelativeTime } from "@/lib/utils";

export default function OrganizationSettingsPage() {
  const { active } = useActiveOrganization();
  const { data: activity } = useActivityLog(active?.id ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">General information, security and danger zone.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic workspace information.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{active?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Slug</p>
            <p className="font-mono font-medium">{active?.slug ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Account, membership, billing, and resource changes across this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col p-0">
          {(activity ?? []).map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 border-b border-border/60 px-6 py-3 last:border-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <History className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.action.replace(/_/g, " ").replace(/\./g, " · ")}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.user?.fullName ?? entry.user?.email ?? "System"}
                  {entry.project ? ` · ${entry.project.name}` : ""} · {entry.resourceType}
                </p>
              </div>
              <Badge variant={entry.status === "success" ? "success" : "destructive"} className="hidden sm:inline-flex">
                {entry.status}
              </Badge>
              <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">{formatRelativeTime(entry.createdAt)}</span>
            </div>
          ))}
          {(activity ?? []).length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
