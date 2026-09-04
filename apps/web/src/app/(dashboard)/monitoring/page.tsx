import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function MonitoringPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Monitoring</h1>
        <p className="text-sm text-muted-foreground">CPU, RAM, disk, network and error-rate graphs per service.</p>
      </div>
      <ComingSoon
        title="Metrics Dashboards"
        description="Per-service CPU/RAM/network charts backed by Prometheus + Grafana land alongside the runtime-agent in Phase 1's remaining slice."
        phase="Phase 1 (in progress)"
      />
    </div>
  );
}
