"use client";

import { useState } from "react";
import { Plus, Trash2, Copy, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useApiKeys, useCreateApiKey, useRevokeApiKey, API_KEY_PERMISSIONS } from "@/hooks/use-api-keys";
import { useWebhooks, useCreateWebhook, useDeleteWebhook, useWebhookDeliveries, WEBHOOK_EVENTS } from "@/hooks/use-webhooks";
import { toast } from "@/lib/store/toast-store";
import { formatRelativeTime } from "@/lib/utils";

export default function ApiKeysPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Keys & Webhooks</h1>
        <p className="text-sm text-muted-foreground">Programmatic access and outgoing event notifications.</p>
      </div>
      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>
        <TabsContent value="keys">
          <ApiKeysSection />
        </TabsContent>
        <TabsContent value="webhooks">
          <WebhooksSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ApiKeysSection() {
  const { active } = useActiveOrganization();
  const { data: keys } = useApiKeys(active?.id ?? null);
  const createKey = useCreateApiKey(active?.id ?? null);
  const revokeKey = useRevokeApiKey(active?.id ?? null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const togglePermission = (p: string) => {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setName(""); setPermissions([]); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Create Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create an API key</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input placeholder="CI Deploy Key" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Permissions</Label>
                <div className="flex flex-wrap gap-2">
                  {API_KEY_PERMISSIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePermission(p)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        permissions.includes(p)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                loading={createKey.isPending}
                disabled={!name || permissions.length === 0}
                onClick={() =>
                  createKey.mutate(
                    { name, permissions },
                    {
                      onSuccess: (data) => {
                        setCreatedKey(data.key);
                        setOpen(false);
                        setName("");
                        setPermissions([]);
                      },
                    },
                  )
                }
              >
                Create Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Key</th>
                <th className="p-4 font-medium">Permissions</th>
                <th className="p-4 font-medium">Last Used</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(keys ?? []).map((k) => (
                <tr key={k.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4 font-medium">{k.name}</td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">{k.prefix}…</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {k.permissions.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{k.lastUsedAt ? formatRelativeTime(k.lastUsedAt) : "Never"}</td>
                  <td className="p-4">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmRevokeId(k.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {(keys ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">No API keys yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!createdKey} onOpenChange={(v) => !v && setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>This key is shown once and cannot be retrieved again. Store it somewhere safe.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-md border border-border p-2.5 font-mono text-xs">
            <p className="truncate">{createdKey}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(createdKey ?? ""); toast({ title: "Copied" }); }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmRevokeId} onOpenChange={(v) => !v && setConfirmRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this API key?</DialogTitle>
            <DialogDescription>Any integration using this key will immediately stop working. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevokeId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={revokeKey.isPending}
              onClick={() => confirmRevokeId && revokeKey.mutate(confirmRevokeId, { onSuccess: () => setConfirmRevokeId(null) })}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WebhooksSection() {
  const { active } = useActiveOrganization();
  const { data: webhooks } = useWebhooks(active?.id ?? null);
  const createWebhook = useCreateWebhook(active?.id ?? null);
  const deleteWebhook = useDeleteWebhook(active?.id ?? null);

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleEvent = (e: string) => {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setUrl(""); setEvents([]); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Add Webhook</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a webhook</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Endpoint URL</Label>
                <Input placeholder="https://example.com/webhooks/clouddeploy" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Events</Label>
                <div className="flex flex-wrap gap-2">
                  {WEBHOOK_EVENTS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => toggleEvent(e)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        events.includes(e)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                loading={createWebhook.isPending}
                disabled={!url || events.length === 0}
                onClick={() =>
                  createWebhook.mutate(
                    { url, events },
                    { onSuccess: () => { setOpen(false); setUrl(""); setEvents([]); } },
                  )
                }
              >
                Create Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3">
        {(webhooks ?? []).map((w) => (
          <Card key={w.id}>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">{w.url}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {w.events.map((e) => <Badge key={e} variant="outline">{e}</Badge>)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                  >
                    {w._count?.deliveries ?? 0} deliveries <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedId === w.id ? "rotate-180" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteId(w.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {expandedId === w.id && <DeliveryHistory webhookId={w.id} />}
            </CardContent>
          </Card>
        ))}
        {(webhooks ?? []).length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No webhooks yet.</CardContent></Card>
        )}
      </div>

      <Dialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this webhook?</DialogTitle>
            <DialogDescription>This stops all future event deliveries to this endpoint. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={deleteWebhook.isPending}
              onClick={() => confirmDeleteId && deleteWebhook.mutate(confirmDeleteId, { onSuccess: () => setConfirmDeleteId(null) })}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveryHistory({ webhookId }: { webhookId: string }) {
  const { data: deliveries } = useWebhookDeliveries(webhookId);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="p-2.5 font-medium">Event</th>
            <th className="p-2.5 font-medium">Status</th>
            <th className="p-2.5 font-medium">Attempt</th>
            <th className="p-2.5 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {(deliveries ?? []).map((d) => (
            <tr key={d.id} className="border-b border-border/60 last:border-0">
              <td className="p-2.5 font-mono">{d.event}</td>
              <td className="p-2.5">
                <Badge variant={d.succeeded ? "success" : "destructive"}>{d.responseStatus ?? "no response"}</Badge>
              </td>
              <td className="p-2.5 text-muted-foreground">#{d.attempt}</td>
              <td className="p-2.5 text-muted-foreground">{formatRelativeTime(d.createdAt)}</td>
            </tr>
          ))}
          {(deliveries ?? []).length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No deliveries yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
