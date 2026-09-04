"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useProjects } from "@/hooks/use-projects";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";
import { formatRelativeTime } from "@/lib/utils";

export default function DomainsPage() {
  const { active } = useActiveOrganization();
  const { data: projects } = useProjects(active?.id ?? null);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState("");
  const [projectId, setProjectId] = useState("");

  const { data: domains, isLoading } = useQuery({
    queryKey: ["domains", active?.id],
    queryFn: () => api.get<any[]>(`/domains?organizationId=${active?.id}`),
    enabled: !!active?.id,
  });

  const create = useMutation({
    mutationFn: () => api.post(`/domains?organizationId=${active?.id}`, { projectId, hostname }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", active?.id] });
      toast({ title: "Domain added", description: "Configure the DNS records to activate it.", variant: "success" });
      setOpen(false);
      setHostname("");
    },
  });

  const verify = useMutation({
    mutationFn: (domainId: string) => api.post(`/domains/${domainId}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", active?.id] });
      toast({ title: "Checking DNS and issuing SSL..." });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Domains</h1>
          <p className="text-sm text-muted-foreground">Platform subdomains and custom domains across your projects.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Add Domain</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Connect a custom domain</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Project</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Select a project</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Domain</Label>
                <Input placeholder="myshop.com" value={hostname} onChange={(e) => setHostname(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={!projectId || !hostname} loading={create.isPending} onClick={() => create.mutate()}>
                Generate DNS Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!isLoading && (domains ?? []).length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState title="No Domains" description="Add a custom domain to one of your projects." /></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="p-4 font-medium">Domain</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Project</th>
                  <th className="p-4 font-medium">DNS Status</th>
                  <th className="p-4 font-medium">SSL</th>
                  <th className="p-4 font-medium">Added</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(domains ?? []).map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="p-4 font-medium">{d.hostname}</td>
                    <td className="p-4 text-muted-foreground">{d.type === "PLATFORM" ? "Platform Domain" : "Custom"}</td>
                    <td className="p-4 text-muted-foreground">{d.project?.name ?? "—"}</td>
                    <td className="p-4"><StatusBadge status={d.status} /></td>
                    <td className="p-4">
                      {d.ssl?.status === "ACTIVE" ? (
                        <span className="flex items-center gap-1 text-xs text-success"><ShieldCheck className="h-3.5 w-3.5" /> Active</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">{formatRelativeTime(d.createdAt)}</td>
                    <td className="p-4">
                      {d.status !== "ACTIVE" && (
                        <Button size="sm" variant="outline" onClick={() => verify.mutate(d.id)} loading={verify.isPending}>Verify</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
