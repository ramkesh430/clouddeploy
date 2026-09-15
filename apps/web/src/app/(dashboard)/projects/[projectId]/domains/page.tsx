"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Copy, Plus, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useCreateDomain, useDomains, useRefreshSsl, useRemoveDomain, useVerifyDomain } from "@/hooks/use-domains";
import { toast } from "@/lib/store/toast-store";

export default function ProjectDomainsPage() {
  const params = useParams<{ projectId: string }>();
  const { active } = useActiveOrganization();
  const { data: payload } = useDomains(active?.id ?? null);
  const create = useCreateDomain(active?.id ?? null);
  const verify = useVerifyDomain(active?.id ?? null);
  const refreshSsl = useRefreshSsl(active?.id ?? null);
  const remove = useRemoveDomain(active?.id ?? null);
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState("");

  const projectDomains = (payload?.data ?? []).filter((d) => d.projectId === params.projectId);
  const edge = payload?.edge;

  return (
    <div className="flex flex-col gap-4">
      {edge?.banner && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">{edge.banner}</div>
      )}
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Add Custom Domain</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Connect a custom domain</DialogTitle></DialogHeader>
            <Input placeholder="erp.customer-domain.com" value={hostname} onChange={(e) => setHostname(e.target.value)} />
            <DialogFooter>
              <Button
                onClick={() =>
                  create.mutate(
                    { projectId: params.projectId, hostname },
                    { onSuccess: () => { setOpen(false); setHostname(""); } },
                  )
                }
                loading={create.isPending}
              >
                Generate DNS Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {projectDomains.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState title="No Domains" description="A platform subdomain is created automatically when the project exists." /></CardContent></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {projectDomains.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.hostname}</span>
                    <span className="text-xs text-muted-foreground">{d.type === "PLATFORM" ? "Platform" : "Custom"}</span>
                    <StatusBadge status={d.dnsStatus === "PENDING" ? "PENDING_DNS" : d.dnsStatus} />
                    {d.sslStatus === "ACTIVE" ? (
                      <span className="flex items-center gap-1 text-xs text-success"><ShieldCheck className="h-3.5 w-3.5" /> SSL Active</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">SSL pending</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => verify.mutate(d.id)} loading={verify.isPending}>Verify DNS</Button>
                    {d.copyRecord && (
                      <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(`${d.copyRecord!.type} ${d.copyRecord!.name} ${d.copyRecord!.value}`).then(() => toast({ title: "Copied DNS record", variant: "success" }))}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => refreshSsl.mutate(d.id)}>Retry SSL</Button>
                    {d.type === "CUSTOM" && <Button size="sm" variant="ghost" onClick={() => remove.mutate(d.id)}>Remove</Button>}
                  </div>
                </div>
                {d.lastError && <p className="text-xs text-destructive">{d.lastError}</p>}
                {d.dnsRecords && (
                  <div className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">
                    {Object.values(d.dnsRecords).map((r, i) => (
                      <div key={i} className="flex gap-4 py-0.5">
                        <span className="w-14 text-muted-foreground">{r.type}</span>
                        <span className="w-56">{r.name}</span>
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
