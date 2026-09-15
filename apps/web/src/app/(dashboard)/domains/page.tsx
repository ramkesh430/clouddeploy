"use client";

import { Fragment, useState } from "react";
import { Copy, ExternalLink, Globe, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
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
import { useCreateDomain, useDomains, useRefreshSsl, useRemoveDomain, useVerifyDomain } from "@/hooks/use-domains";
import { toast } from "@/lib/store/toast-store";
import { formatRelativeTime } from "@/lib/utils";

export default function DomainsPage() {
  const { active } = useActiveOrganization();
  const { data: projects } = useProjects(active?.id ?? null);
  const { data: payload, isLoading } = useDomains(active?.id ?? null);
  const create = useCreateDomain(active?.id ?? null);
  const verify = useVerifyDomain(active?.id ?? null);
  const refreshSsl = useRefreshSsl(active?.id ?? null);
  const remove = useRemoveDomain(active?.id ?? null);
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState("");
  const [projectId, setProjectId] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const domains = payload?.data ?? [];
  const edge = payload?.edge;

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: label, variant: "success" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Domains</h1>
          <p className="text-sm text-muted-foreground">
            Automatic platform subdomains and custom domains. DNS is verified before a name is marked Active.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Add Custom Domain
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
                <Input placeholder="erp.customer-domain.com" value={hostname} onChange={(e) => setHostname(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={!projectId || !hostname}
                loading={create.isPending}
                onClick={() =>
                  create.mutate(
                    { projectId, hostname },
                    {
                      onSuccess: () => {
                        setOpen(false);
                        setHostname("");
                      },
                    },
                  )
                }
              >
                Generate DNS Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {edge?.banner && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          {edge.banner}
          <p className="mt-1 text-xs text-muted-foreground">
            Wildcard record when you go public: {edge.wildcardRecord.type} {edge.wildcardRecord.name} → {edge.wildcardRecord.value}
          </p>
        </div>
      )}

      {!isLoading && domains.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState title="No Domains" description="Create a project to get an automatic platform subdomain." />
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
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">DNS Status</th>
                    <th className="px-5 py-3 font-medium">SSL Status</th>
                    <th className="px-5 py-3 font-medium">Target</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((d) => (
                    <Fragment key={d.id}>
                      <tr className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <Globe className="h-4 w-4" />
                            </div>
                            <button className="truncate text-left font-medium hover:text-primary" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                              {d.hostname}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{d.project?.name ?? "—"}</td>
                        <td className="px-5 py-3 text-muted-foreground">{d.type === "PLATFORM" ? "Platform" : "Custom"}</td>
                        <td className="px-5 py-3">
                          <StatusBadge status={d.dnsStatus === "PENDING" ? "PENDING_DNS" : d.dnsStatus} />
                        </td>
                        <td className="px-5 py-3">
                          {d.sslStatus === "ACTIVE" ? (
                            <span className="flex items-center gap-1 text-xs text-success">
                              <ShieldCheck className="h-3.5 w-3.5" /> Active
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{d.sslStatus === "ISSUING" ? "Issuing" : "Pending"}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{d.target ?? "—"}</td>
                        <td className="px-5 py-3 text-muted-foreground">{formatRelativeTime(d.createdAt)}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => verify.mutate(d.id)} loading={verify.isPending}>
                              Verify DNS
                            </Button>
                            {d.copyRecord && (
                              <Button size="sm" variant="ghost" onClick={() => copyText("DNS record", `${d.copyRecord!.type} ${d.copyRecord!.name} ${d.copyRecord!.value}`)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {d.openUrl ? (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={d.openUrl} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" disabled title="Domain is not publicly reachable yet">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => refreshSsl.mutate(d.id)} loading={refreshSsl.isPending}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            {d.type === "CUSTOM" && (
                              <Button size="sm" variant="ghost" onClick={() => remove.mutate(d.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded === d.id && (
                        <tr className="border-b border-border/60 bg-muted/20">
                          <td colSpan={8} className="px-5 py-3">
                            {d.lastError && <p className="mb-2 text-xs text-destructive">{d.lastError}</p>}
                            <p className="mb-2 text-xs font-medium text-muted-foreground">DNS records to configure</p>
                            <div className="overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-xs">
                              {d.dnsRecords &&
                                Object.values(d.dnsRecords).map((r, i) => (
                                  <div key={i} className="flex gap-4 py-0.5">
                                    <span className="w-14 text-muted-foreground">{r.type}</span>
                                    <span className="w-56">{r.name}</span>
                                    <span className="truncate">{r.value}</span>
                                    {r.purpose && <span className="text-muted-foreground">— {r.purpose}</span>}
                                  </div>
                                ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
