"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
      toast({
        title: "Domain added",
        description: "Configure the DNS records to activate it.",
        variant: "success",
      });
      setOpen(false);
      setHostname("");
    },
  });

  const verify = useMutation({
    mutationFn: (domainId: string) =>
      api.post<{ id: string; status: string; verificationError?: string }>(`/domains/${domainId}/verify`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["domains", active?.id] });
      if (data.status === "ACTIVE") {
        toast({
          title: "Domain verified",
          description: "DNS is pointed correctly. SSL issuance is next.",
          variant: "success",
        });
      } else {
        toast({
          title: "DNS not verified yet",
          description: data.verificationError ?? "DNS records don't match yet",
          variant: "destructive",
        });
      }
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Domains</h1>
          <p className="text-sm text-muted-foreground">
            Platform subdomains and custom domains across your projects.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect a custom domain</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Project</Label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">Select a project</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Domain</Label>
                <Input
                  placeholder="myshop.com"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={!projectId || !hostname}
                loading={create.isPending}
                onClick={() => create.mutate()}
              >
                Generate DNS Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!isLoading && (domains ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState title="No Domains" description="Add a custom domain to one of your projects." />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Domain</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">SSL</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(domains ?? []).map((d) => (
                    <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Globe className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{d.hostname}</p>
                            <p className="truncate text-xs text-muted-foreground">{d.project?.name ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {d.type === "PLATFORM" ? "Platform" : "Custom"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-5 py-3">
                        {d.ssl?.status === "ACTIVE" ? (
                          <span className="flex items-center gap-1 text-xs text-success">
                            <ShieldCheck className="h-3.5 w-3.5" /> Active
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No SSL</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{formatRelativeTime(d.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        {d.status !== "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => verify.mutate(d.id)}
                            loading={verify.isPending}
                          >
                            Verify
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
