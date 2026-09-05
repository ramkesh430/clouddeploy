"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useAdminResource } from "@/hooks/use-phase3";

interface RiskEvent { id: string; type: string; severity: string; status: string; title: string; evidence: Record<string, unknown>; organization?: { name: string }; project?: { name: string }; projectId?: string | null; createdAt: string }
const reviewActions = [["MANUAL_REVIEW", "Claim review"], ["TERMINATE_CONTAINERS", "Stop containers"], ["SUSPEND_PROJECT", "Suspend project"], ["SUSPEND_USER", "Suspend user"], ["DISMISS", "Dismiss"]] as const;

export default function AdminAbusePage() {
  const client = useQueryClient();
  const { data = [] } = useAdminResource<RiskEvent[]>("/admin/abuse/risk-events");
  const action = useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => api.post(`/admin/abuse/risk-events/${id}/actions`, { action: name, reason: `Admin selected ${name.toLowerCase().replaceAll("_", " ")}` }), onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "/admin/abuse/risk-events"] }) });
  function apply(id: string, name: string) { if (["TERMINATE_CONTAINERS", "SUSPEND_PROJECT", "SUSPEND_USER"].includes(name) && !window.confirm("Apply this protective action? It will affect active customer workloads or access.")) return; action.mutate({ id, name }); }
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Abuse management</h1><p className="text-sm text-muted-foreground">Review mining, spam, malware, phishing, scanning, and resource-abuse signals.</p></div><Card><CardHeader><CardTitle>Risk events</CardTitle></CardHeader><CardContent className="space-y-3">{data.map((event) => <div className="space-y-3 rounded-md border p-4" key={event.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{event.title}</p><p className="text-sm text-muted-foreground">{event.type.replaceAll("_", " ")} · {event.organization?.name ?? "Unknown organization"}{event.project ? ` · ${event.project.name}` : ""} · {new Date(event.createdAt).toLocaleString()}</p></div><span className="text-sm font-medium">{event.severity} · {event.status}</span></div><p className="text-sm text-muted-foreground">Evidence is retained as structured audit data and exposed only to platform administrators.</p><div className="flex flex-wrap gap-2">{reviewActions.map(([name, label]) => <Button size="sm" variant={name.startsWith("SUSPEND") || name === "TERMINATE_CONTAINERS" ? "destructive" : "outline"} key={name} disabled={action.isPending || (name === "SUSPEND_PROJECT" && !event.projectId) || name === "SUSPEND_USER"} onClick={() => apply(event.id, name)}>{label}</Button>)}</div></div>)}</CardContent></Card></div>;
}
