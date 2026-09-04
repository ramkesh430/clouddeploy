import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function UsagePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <p className="text-sm text-muted-foreground">Build minutes, CPU/RAM hours, bandwidth and storage.</p>
      </div>
      <ComingSoon
        title="Usage Tracking"
        description="Metered usage recording ships together with billing in Phase 2, backed by the UsageRecord model already in the schema."
      />
    </div>
  );
}
