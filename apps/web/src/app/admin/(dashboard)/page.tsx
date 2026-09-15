"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  CircleDollarSign,
  Database,
  HardDrive,
  Package,
  Users,
} from "lucide-react";
import { useAdminResource } from "@/hooks/use-phase3";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import { UsageCircle } from "@/components/admin/dashboard/usage-circle";
import { DeploymentStatusBadge } from "@/components/admin/dashboard/deployment-status-badge";
import { GrowthChart } from "@/components/admin/dashboard/growth-chart";
import { DeploymentsDonut } from "@/components/admin/dashboard/deployments-donut";
import { formatBytes, formatCurrency, formatRelativeTime } from "@/lib/utils";

interface Capacity { total: number; used: number }
interface DashboardData {
  users: number;
  organizations: number;
  projects: number;
  runningContainers: number;
  activeDatabases: number;
  failedDeployments: number;
  buildQueue: number;
  monthlyRevenueCents: number;
  cpuCapacity: Capacity;
  ramCapacityMb: Capacity;
  storageCapacityMb: Capacity;
  bandwidthCapacityGb: Capacity;
  deployments30d: { total: number; succeeded: number; failed: number; running: number; queued: number };
}

interface GrowthPoint { value: number }
interface GrowthResponse { points: GrowthPoint[] }

interface AdminDeployment {
  id: string;
  status: string;
  branch: string;
  commitSha: string | null;
  durationMs: number | null;
  createdAt: string;
  project: { name: string; organization?: { name: string } | null };
}

interface PlatformServiceRow { id: string; name: string; status: string; uptimePct30d: number }
interface AuditLogRow { id: string; action: string; resourceType: string; createdAt: string; user?: { email: string } | null; organization?: { name: string } | null }
interface RiskEventRow { id: string; type: string; severity: string; title: string; createdAt: string; organization?: { name: string } | null; service?: { name: string } | null }

function pctChange(data: GrowthResponse | undefined): { change: string; positive: boolean } | null {
  const points = data?.points ?? [];
  if (points.length < 2) return null;
  const first = points[0]!.value;
  const last = points[points.length - 1]!.value;
  if (first === 0) return last > 0 ? { change: "New this month", positive: true } : null;
  const pct = ((last - first) / first) * 100;
  return { change: `${Math.abs(Math.round(pct))}% from last month`, positive: pct >= 0 };
}

export default function AdminDashboard() {
  const { data } = useAdminResource<DashboardData>("/admin/dashboard");
  const { data: usersGrowth } = useAdminResource<GrowthResponse>("/admin/growth?metric=users&days=30");
  const { data: orgsGrowth } = useAdminResource<GrowthResponse>("/admin/growth?metric=organizations&days=30");
  const { data: projectsGrowth } = useAdminResource<GrowthResponse>("/admin/growth?metric=projects&days=30");
  const { data: revenueGrowth } = useAdminResource<GrowthResponse>("/admin/growth?metric=revenue&days=30");
  const { data: deployments } = useAdminResource<AdminDeployment[]>("/admin/deployments?limit=5");
  const { data: statusPayload } = useAdminResource<{ services: PlatformServiceRow[] }>("/status");
  const { data: activity } = useAdminResource<AuditLogRow[]>("/admin/system-logs?limit=5");
  const { data: alerts } = useAdminResource<RiskEventRow[]>("/admin/abuse/risk-events");


  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Overview of your CloudDeploy platform</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <StatCard title="Total Users" value={data ? data.users.toLocaleString() : "—"} icon={<Users className="h-5 w-5" />} {...(pctChange(usersGrowth) ?? {})} />
            <StatCard title="Organizations" value={data ? data.organizations.toLocaleString() : "—"} icon={<Building2 className="h-5 w-5" />} {...(pctChange(orgsGrowth) ?? {})} />
            <StatCard title="Projects" value={data ? data.projects.toLocaleString() : "—"} icon={<Package className="h-5 w-5" />} {...(pctChange(projectsGrowth) ?? {})} />
            <StatCard title="Running Containers" value={data ? data.runningContainers.toLocaleString() : "—"} icon={<Boxes className="h-5 w-5" />} />
            <StatCard title="Active Databases" value={data ? data.activeDatabases.toLocaleString() : "—"} icon={<Database className="h-5 w-5" />} />
            <StatCard title="Build Queue" value={data ? data.buildQueue.toLocaleString() : "—"} icon={<Activity className="h-5 w-5" />} />
            <StatCard title="Monthly Revenue" value={data ? formatCurrency(data.monthlyRevenueCents / 100) : "—"} icon={<CircleDollarSign className="h-5 w-5" />} {...(pctChange(revenueGrowth) ?? {})} />
            <StatCard title="Storage Used" value={data ? formatBytes(data.storageCapacityMb.used * 1024 * 1024) : "—"} icon={<HardDrive className="h-5 w-5" />} />
          </div>

          <GrowthChart />

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-[#20313e] bg-[#101e28] p-5">
              <h2 className="mb-4 font-semibold text-white">Resource Usage</h2>
              {data ? (
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                  <UsageCircle title="CPU" percentage={(data.cpuCapacity.used / (data.cpuCapacity.total || 1)) * 100} caption={`${data.cpuCapacity.used.toFixed(0)} / ${data.cpuCapacity.total.toFixed(0)} cores`} />
                  <UsageCircle title="Memory" percentage={(data.ramCapacityMb.used / (data.ramCapacityMb.total || 1)) * 100} caption={`${(data.ramCapacityMb.used / 1024).toFixed(0)} / ${(data.ramCapacityMb.total / 1024).toFixed(0)} GB`} />
                  <UsageCircle title="Storage" percentage={(data.storageCapacityMb.used / (data.storageCapacityMb.total || 1)) * 100} caption={`${(data.storageCapacityMb.used / 1024).toFixed(1)} / ${(data.storageCapacityMb.total / 1024).toFixed(1)} TB`} />
                  <UsageCircle
                    title="Bandwidth"
                    percentage={(data.bandwidthCapacityGb.used / (data.bandwidthCapacityGb.total || 1)) * 100}
                    caption={data.bandwidthCapacityGb.used === 0 ? "Not metered yet" : `${data.bandwidthCapacityGb.used.toFixed(0)} / ${data.bandwidthCapacityGb.total.toFixed(0)} GB`}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-600">Loading…</p>
              )}
            </section>

            <section className="rounded-lg border border-[#20313e] bg-[#101e28] p-5">
              <h2 className="mb-4 font-semibold text-white">Deployments Overview (30d)</h2>
              {data ? (
                <DeploymentsDonut
                  total={data.deployments30d.total}
                  segments={[
                    { label: "Successful", value: data.deployments30d.succeeded, color: "text-emerald-400", legendColor: "bg-emerald-400" },
                    { label: "Failed", value: data.deployments30d.failed, color: "text-red-400", legendColor: "bg-red-400" },
                    { label: "Running", value: data.deployments30d.running, color: "text-blue-400", legendColor: "bg-blue-400" },
                    { label: "Queued", value: data.deployments30d.queued, color: "text-amber-400", legendColor: "bg-amber-400" },
                  ]}
                />
              ) : (
                <p className="text-sm text-slate-600">Loading…</p>
              )}
            </section>
          </div>

          <section className="overflow-hidden rounded-lg border border-[#20313e] bg-[#101e28]">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-semibold text-white">Recent Deployments</h2>
              <Link href="/admin/deployments" className="text-sm text-blue-400">View all</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-[#101e28] text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">ID</th>
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Organization</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Duration</th>
                    <th className="px-5 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(deployments ?? []).map((d) => (
                    <tr key={d.id} className="border-t border-[#20313e]/80">
                      <td className="px-5 py-3 font-mono text-xs text-white">#{d.id.slice(0, 8)}</td>
                      <td className="px-5 py-3 text-blue-400">{d.project.name}</td>
                      <td className="px-5 py-3 text-slate-400">{d.project.organization?.name ?? "—"}</td>
                      <td className="px-5 py-3"><DeploymentStatusBadge status={d.status} /></td>
                      <td className="px-5 py-3 text-slate-400">{d.durationMs ? `${Math.round(d.durationMs / 1000)}s` : "—"}</td>
                      <td className="px-5 py-3 text-slate-500">{formatRelativeTime(d.createdAt)}</td>
                    </tr>
                  ))}
                  {deployments?.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-600">No deployments yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-[#20313e] bg-[#101e28] p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold text-white">System Status</h2>
              <Link href="/status" className="text-xs text-blue-400">View all</Link>
            </div>
            <div className="space-y-4">
              {(statusPayload?.services ?? []).map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${service.status === "OPERATIONAL" ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <span className="text-slate-300">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${service.status === "OPERATIONAL" ? "text-emerald-400" : "text-amber-400"}`}>
                      {service.status === "OPERATIONAL" ? "Operational" : service.status.replace(/_/g, " ")}
                    </span>
                    <span className="w-14 text-right text-xs text-slate-500">{service.uptimePct30d.toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#20313e] bg-[#101e28] p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold text-white">Recent Activity</h2>
              <Link href="/admin/system-logs" className="text-xs text-blue-400">View all</Link>
            </div>
            <div className="space-y-5">
              {(activity ?? []).slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{entry.action.replace(/_/g, " ").replace(/\./g, " · ")}</p>
                    <p className="truncate text-xs text-slate-500">{entry.organization?.name ?? entry.user?.email ?? entry.resourceType}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-600">{formatRelativeTime(entry.createdAt)}</span>
                </div>
              ))}
              {activity?.length === 0 && <p className="text-sm text-slate-600">No activity recorded yet.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-[#20313e] bg-[#101e28] p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold text-white">Recent Alerts</h2>
              <Link href="/admin/abuse" className="text-xs text-blue-400">View all</Link>
            </div>
            <div className="space-y-5">
              {(alerts ?? []).slice(0, 5).map((alert) => {
                const tone = alert.severity === "CRITICAL" || alert.severity === "HIGH" ? "red" : alert.severity === "MEDIUM" ? "amber" : "blue";
                return (
                  <div key={alert.id} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        tone === "red" ? "bg-red-500/10 text-red-400" : tone === "amber" ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{alert.title}</p>
                      <p className="truncate text-xs text-slate-500">{alert.organization?.name ?? alert.service?.name ?? alert.type}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-slate-600">{formatRelativeTime(alert.createdAt)}</span>
                  </div>
                );
              })}
              {alerts?.length === 0 && <p className="text-sm text-slate-600">No risk events recorded.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
