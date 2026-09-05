"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useAdminResource } from "@/hooks/use-phase3";

interface ServerRecord {
  id: string;
  hostname: string;
  role: string;
  region: string;
  status: string;
  cpuCores: number;
  ramMb: number;
  lastHeartbeatAt: string | null;
}

const actions = [
  ["DRAIN", "Drain"],
  ["ENTER_MAINTENANCE", "Maintenance"],
  ["EXIT_MAINTENANCE", "Exit maintenance"],
  ["RESTART_AGENT", "Restart agent"],
  ["DISABLE", "Disable"],
  ["REMOVE", "Remove"],
] as const;

export default function AdminServersPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useAdminResource<ServerRecord[]>("/admin/infrastructure/servers");
  const action = useMutation({
    mutationFn: ({ serverId, name }: { serverId: string; name: string }) => api.post(`/admin/infrastructure/servers/${serverId}/actions`, { action: name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "/admin/infrastructure/servers"] }),
  });

  function execute(serverId: string, name: string) {
    if (["DISABLE", "REMOVE"].includes(name) && !window.confirm(`${name === "REMOVE" ? "Remove" : "Disable"} this server? Workloads must already be drained.`)) return;
    action.mutate({ serverId, name });
  }

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">Servers</h1><p className="text-sm text-muted-foreground">Control registered agents without bypassing drain and maintenance workflows.</p></div>
    <Card><CardHeader><CardTitle>Infrastructure agents</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
      {isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : <table className="w-full min-w-[980px] text-left text-sm"><thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr>{["Server", "Role", "Region", "Status", "CPU", "RAM", "Heartbeat", "Actions"].map((label) => <th className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{data.map((server) => <tr key={server.id}><td className="px-4 py-3 font-medium">{server.hostname}</td><td className="px-4 py-3">{server.role}</td><td className="px-4 py-3">{server.region}</td><td className="px-4 py-3">{server.status}</td><td className="px-4 py-3">{server.cpuCores}</td><td className="px-4 py-3">{server.ramMb} MB</td><td className="px-4 py-3">{server.lastHeartbeatAt ? new Date(server.lastHeartbeatAt).toLocaleString() : "Never"}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{actions.map(([name, label]) => <Button key={name} size="sm" variant={name === "REMOVE" || name === "DISABLE" ? "destructive" : "outline"} disabled={action.isPending} onClick={() => execute(server.id, name)}>{label}</Button>)}</div></td></tr>)}</tbody></table>}
    </CardContent></Card>
  </div>;
}
