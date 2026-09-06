const RUNNING_STATUSES = new Set(["CLONING", "BUILDING", "UPLOADING", "DEPLOYING", "HEALTH_CHECK"]);

const LABELS: Record<string, string> = {
  LIVE: "Success",
  QUEUED: "Queued",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  ROLLED_BACK: "Rolled back",
};

/** Maps the real DeploymentStatus enum to the mockup's Success/Failed/Running
 * badge language — the platform's actual statuses are more granular
 * (CLONING, BUILDING, ...), all of which read as "Running" here. */
export function DeploymentStatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? (RUNNING_STATUSES.has(status) ? "Running" : status);
  let style = "bg-slate-700/50 text-slate-300";
  if (label === "Success") style = "bg-emerald-500/15 text-emerald-400";
  else if (label === "Failed") style = "bg-red-500/15 text-red-400";
  else if (label === "Running") style = "bg-blue-500/15 text-blue-400";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>{label}</span>;
}
