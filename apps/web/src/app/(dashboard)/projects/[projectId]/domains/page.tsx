"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export default function ProjectDomainsPage() {
  const params = useParams<{ projectId: string }>();
  const { active } = useActiveOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState("");

  const { data: domains } = useQuery({
    queryKey: ["domains", active?.id],
    queryFn: () => api.get<any[]>(`/domains?organizationId=${active?.id}`),
    enabled: !!active?.id,
  });

  const projectDomains = (domains ?? []).filter((d) => d.projectId === params.projectId);

  const create = useMutation({
    mutationFn: () => api.post(`/domains?organizationId=${active?.id}`, { projectId: params.projectId, hostname }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", active?.id] });
      toast({ title: "Domain added", description: "Follow the DNS instructions to activate it.", variant: "success" });
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
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Add Domain</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Connect a custom domain</DialogTitle></DialogHeader>
            <Input placeholder="myshop.com" value={hostname} onChange={(e) => setHostname(e.target.value)} />
            <DialogFooter>
              <Button onClick={() => create.mutate()} loading={create.isPending}>Generate DNS Configuration</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {projectDomains.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState title="No Domains" description="Add a custom domain to this project." /></CardContent></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {projectDomains.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{d.hostname}</span>
                    <StatusBadge status={d.status} />
                    {d.ssl?.status === "ACTIVE" && (
                      <span className="flex items-center gap-1 text-xs text-success"><ShieldCheck className="h-3.5 w-3.5" /> SSL Active</span>
                    )}
                  </div>
                  {d.status !== "ACTIVE" && (
                    <Button size="sm" variant="outline" onClick={() => verify.mutate(d.id)} loading={verify.isPending}>
                      Verify
                    </Button>
                  )}
                </div>
                {d.status !== "ACTIVE" && d.dnsRecords && (
                  <div className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">
                    {Object.values(d.dnsRecords as Record<string, any>).map((r: any, i: number) => (
                      <div key={i} className="flex gap-4 py-0.5">
                        <span className="w-14 text-muted-foreground">{r.type}</span>
                        <span className="w-32">{r.name}</span>
                        <span className="truncate">{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
