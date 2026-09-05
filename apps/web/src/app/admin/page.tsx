"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useAdminResource } from "@/hooks/use-phase3";

export default function AdminDashboardPage() {
  const { data } = useAdminResource<Record<string, unknown>>("/admin/dashboard");
  const labels: Array<[string, string]> = [["users", "Users"], ["organizations", "Organizations"], ["projects", "Projects"], ["runningContainers", "Running containers"], ["activeDatabases", "Active databases"], ["failedDeployments", "Failed deployments"], ["buildQueue", "Build queue"], ["monthlyRevenueCents", "Monthly revenue (¢)"], ["storageUsedMb", "Storage used MB"], ["bandwidthBytes", "Bandwidth bytes"]];
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1><p className="text-sm text-muted-foreground">Commercial, workload, and infrastructure health across every tenant.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{labels.map(([key, label]) => <Card key={key}><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{String(data?.[key] ?? "—")}</p></CardContent></Card>)}</div><div className="grid gap-4 lg:grid-cols-2"><CapacityCard title="CPU capacity" value={data?.cpuCapacity} /><CapacityCard title="RAM capacity" value={data?.ramCapacityMb} /></div></div>;
}
function CapacityCard({ title, value }: { title: string; value: unknown }) { const item = value as { used?: number; total?: number } | undefined; const pct = item?.total ? Math.round((item.used ?? 0) / item.total * 100) : 0; return <Card><CardContent className="p-5"><div className="flex justify-between"><span className="font-medium">{title}</span><span className="text-sm text-muted-foreground">{pct}% used</span></div><div className="mt-3 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} /></div></CardContent></Card>; }
