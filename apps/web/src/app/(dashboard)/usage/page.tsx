"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useUsageSummary } from "@/hooks/use-usage";
import { formatBytes } from "@/lib/utils";

function pct(used: number, limit: number): number {
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export default function UsagePage() {
  const { active } = useActiveOrganization();
  const { data } = useUsageSummary(active?.id ?? null);

  const rows = data
    ? [
        {
          label: "Projects",
          used: data.usage.projects,
          limit: data.limits.maxProjects,
          format: (n: number) => `${n}`,
        },
        {
          label: "Databases",
          used: data.usage.databases,
          limit: data.limits.maxDatabases,
          format: (n: number) => `${n}`,
        },
        {
          label: "Team Members",
          used: data.usage.teamMembers,
          limit: data.limits.maxTeamMembers,
          format: (n: number) => `${n}`,
        },
        {
          label: "RAM",
          used: data.usage.ramMb,
          limit: data.limits.maxRamMb,
          format: (n: number) => formatBytes(n * 1024 * 1024),
        },
        {
          label: "Storage",
          used: data.usage.storageGb,
          limit: data.limits.maxStorageGb,
          format: (n: number) => `${n.toFixed(2)} GB`,
        },
        {
          label: "Build Minutes",
          used: data.usage.buildMinutes,
          limit: data.limits.maxBuildMinutes,
          format: (n: number) => `${n} min`,
        },
        {
          label: "Bandwidth",
          used: data.usage.bandwidthGb,
          limit: data.limits.maxBandwidthGb,
          format: (n: number) => `${n} GB`,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
          <p className="text-sm text-muted-foreground">
            Build minutes, CPU/RAM, bandwidth and storage against your plan.
          </p>
        </div>
        {data && <Badge variant="secondary">{data.plan} plan</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current period</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {rows.map((row) => {
            const p = pct(row.used, row.limit);
            return (
              <div key={row.label} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <p className="font-medium">{row.label}</p>
                  <p className="text-muted-foreground">
                    {row.format(row.used)} / {row.format(row.limit)}
                  </p>
                </div>
                <Progress
                  value={p}
                  className={p >= 90 ? "[&>div]:bg-destructive" : p >= 70 ? "[&>div]:bg-warning" : undefined}
                />
              </div>
            );
          })}
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Loading usage...</p>}
        </CardContent>
      </Card>
    </div>
  );
}
