"use client";

import { useState } from "react";
import { Plus, Trash2, Bell } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useDatabases } from "@/hooks/use-databases";
import { useAlertRules, useCreateAlertRule, useSetAlertRuleEnabled, useDeleteAlertRule } from "@/hooks/use-alerts";
import { formatRelativeTime } from "@/lib/utils";

const METRICS = [
  { value: "DATABASE_CONNECTIONS", label: "Database connections" },
  { value: "DATABASE_STORAGE_PCT", label: "Database storage %" },
];

export default function MonitoringPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Monitoring</h1>
        <p className="text-sm text-muted-foreground">Live database metrics and threshold alerts.</p>
      </div>
      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">Alert Rules</TabsTrigger>
          <TabsTrigger value="charts">Metrics Dashboards</TabsTrigger>
        </TabsList>
        <TabsContent value="alerts"><AlertRules /></TabsContent>
        <TabsContent value="charts">
          <ComingSoon
            title="Per-service CPU/RAM charts"
            description="These need a real metrics collector sampling running application containers, which doesn't exist yet in this MVP (the deployment pipeline doesn't run real per-service containers). Database connection count and storage are already live — see Databases → a database → Overview."
            phase="Phase 3"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertRules() {
  const { active } = useActiveOrganization();
  const { data: rules } = useAlertRules(active?.id ?? null);
  const { data: databases } = useDatabases(active?.id ?? null);
  const createRule = useCreateAlertRule(active?.id ?? null);
  const setEnabled = useSetAlertRuleEnabled(active?.id ?? null);
  const deleteRule = useDeleteAlertRule(active?.id ?? null);

  const [open, setOpen] = useState(false);
  const [databaseId, setDatabaseId] = useState("");
  const [metric, setMetric] = useState(METRICS[0].value);
  const [comparator, setComparator] = useState<"GREATER_THAN" | "LESS_THAN">("GREATER_THAN");
  const [threshold, setThreshold] = useState("80");
  const [cooldownMinutes, setCooldownMinutes] = useState("30");

  const databaseName = (id: string | null) => databases?.find((d) => d.id === id)?.name ?? id ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Evaluated every 60 seconds against real, live values. Currently supports database metrics — per-service CPU/RAM alerting
          lands with the real metrics collector.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!databases || databases.length === 0}>
              <Plus className="h-3.5 w-3.5" /> Add Alert Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create an alert rule</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Database</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={databaseId} onChange={(e) => setDatabaseId(e.target.value)}>
                  <option value="">Select a database</option>
                  {(databases ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Metric</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={metric} onChange={(e) => setMetric(e.target.value)}>
                  {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Comparator</Label>
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={comparator} onChange={(e) => setComparator(e.target.value as "GREATER_THAN" | "LESS_THAN")}>
                    <option value="GREATER_THAN">Above</option>
                    <option value="LESS_THAN">Below</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Threshold</Label>
                  <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Cooldown (minutes)</Label>
                <Input type="number" min={1} value={cooldownMinutes} onChange={(e) => setCooldownMinutes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button
                loading={createRule.isPending}
                disabled={!databaseId || !threshold}
                onClick={() =>
                  createRule.mutate(
                    { databaseId, metric, comparator, threshold: Number(threshold), cooldownMinutes: Number(cooldownMinutes) || 30 },
                    { onSuccess: () => setOpen(false) },
                  )
                }
              >
                Create Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="flex flex-col p-0">
          {(rules ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{databaseName(r.databaseId)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.lastTriggeredAt ? `Last triggered ${formatRelativeTime(r.lastTriggeredAt)}` : "Never triggered"} · cooldown {r.cooldownMinutes}m
                </p>
              </div>
              <Badge variant="outline" className="hidden sm:inline-flex">
                {METRICS.find((m) => m.value === r.metric)?.label ?? r.metric} {r.comparator === "GREATER_THAN" ? ">" : "<"} {r.threshold}
              </Badge>
              <button
                onClick={() => setEnabled.mutate({ id: r.id, enabled: !r.enabled })}
                className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${r.enabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${r.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => deleteRule.mutate(r.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {(rules ?? []).length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No alert rules yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
