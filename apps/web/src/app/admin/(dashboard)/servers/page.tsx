"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api-client";
import { useAdminResource } from "@/hooks/use-phase3";
import { ResourceCrudDialog, type FieldValue } from "@/components/admin/resource-crud-dialog";

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

const createFields = [
  { key: "hostname", label: "Hostname", type: "text" as const, required: true, placeholder: "runtime-us-east-04.clouddeploy.internal" },
  { key: "ipAddress", label: "IP address", type: "text" as const, required: true, placeholder: "10.0.4.12" },
  { key: "region", label: "Region", type: "select" as const, required: true, dynamicSource: "regions" as const },
  { key: "role", label: "Role", type: "select" as const, required: true, options: ["CONTROL_PLANE", "BUILD_WORKER", "RUNTIME_NODE", "DATABASE_NODE", "STORAGE_NODE"].map((v) => ({ value: v, label: v })) },
  { key: "cpuCores", label: "CPU cores", type: "number" as const, required: true },
  { key: "ramMb", label: "RAM (MB)", type: "number" as const, required: true },
  { key: "diskMb", label: "Disk (MB)", type: "number" as const, required: true },
];

export default function AdminServersPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useAdminResource<ServerRecord[]>("/admin/infrastructure/servers");
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<{ hostname: string; token: string } | null>(null);

  const action = useMutation({
    mutationFn: ({ serverId, name }: { serverId: string; name: string }) => api.post(`/admin/infrastructure/servers/${serverId}/actions`, { action: name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "/admin/infrastructure/servers"] }),
  });
  const register = useMutation({
    mutationFn: (values: Record<string, FieldValue>) => api.post<{ server: ServerRecord; agentToken: string }>("/admin/infrastructure/servers", values),
    onSuccess: (result, values) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "/admin/infrastructure/servers"] });
      setCreateOpen(false);
      setFormError(null);
      setIssuedToken({ hostname: String(values.hostname), token: result.agentToken });
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  function execute(serverId: string, name: string) {
    if (["DISABLE", "REMOVE"].includes(name) && !window.confirm(`${name === "REMOVE" ? "Remove" : "Disable"} this server? Workloads must already be drained.`)) return;
    action.mutate({ serverId, name });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Servers</h1>
          <p className="text-sm text-muted-foreground">Control registered agents without bypassing drain and maintenance workflows.</p>
        </div>
        <Button onClick={() => { setFormError(null); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> Register server
        </Button>
      </div>

      {issuedToken && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Agent token for {issuedToken.hostname}</p>
          <p className="mt-1 text-muted-foreground">Copy this now — it won&apos;t be shown again. Configure it as the runtime agent&apos;s <code>AGENT_TOKEN</code>.</p>
          <code className="mt-2 block overflow-x-auto rounded bg-background p-2 text-xs">{issuedToken.token}</code>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setIssuedToken(null)}>Dismiss</Button>
        </div>
      )}

      <Card><CardHeader><CardTitle>Infrastructure agents</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
        {isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : <table className="w-full min-w-[980px] text-left text-sm"><thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr>{["Server", "Role", "Region", "Status", "CPU", "RAM", "Heartbeat", "Actions"].map((label) => <th className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{data.map((server) => <tr key={server.id}><td className="px-4 py-3 font-medium">{server.hostname}</td><td className="px-4 py-3">{server.role}</td><td className="px-4 py-3">{server.region}</td><td className="px-4 py-3">{server.status}</td><td className="px-4 py-3">{server.cpuCores}</td><td className="px-4 py-3">{server.ramMb} MB</td><td className="px-4 py-3">{server.lastHeartbeatAt ? new Date(server.lastHeartbeatAt).toLocaleString() : "Never"}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{actions.map(([name, label]) => <Button key={name} size="sm" variant={name === "REMOVE" || name === "DISABLE" ? "destructive" : "outline"} disabled={action.isPending} onClick={() => execute(server.id, name)}>{label}</Button>)}</div></td></tr>)}</tbody></table>}
      </CardContent></Card>

      <ResourceCrudDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Register server"
        fields={createFields}
        submitLabel="Register"
        pending={register.isPending}
        error={formError}
        onSubmit={(values) => register.mutate(values)}
      />
    </div>
  );
}
