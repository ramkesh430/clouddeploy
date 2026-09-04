import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        destructive: "border-transparent bg-destructive/15 text-destructive",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </div>
  );
}

/** Maps a platform status string to the right badge color + label (section 107). */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string; dot?: boolean }> = {
    RUNNING: { variant: "success", label: "Running", dot: true },
    LIVE: { variant: "success", label: "Live", dot: true },
    HEALTHY: { variant: "success", label: "Healthy", dot: true },
    ACTIVE: { variant: "success", label: "Active", dot: true },
    COMPLETED: { variant: "success", label: "Completed" },
    SUCCEEDED: { variant: "success", label: "Succeeded" },
    BUILDING: { variant: "warning", label: "Building", dot: true },
    QUEUED: { variant: "muted", label: "Queued" },
    CLONING: { variant: "warning", label: "Cloning", dot: true },
    UPLOADING: { variant: "warning", label: "Uploading", dot: true },
    DEPLOYING: { variant: "warning", label: "Deploying", dot: true },
    HEALTH_CHECK: { variant: "warning", label: "Health Check", dot: true },
    VERIFYING: { variant: "warning", label: "Verifying", dot: true },
    PENDING: { variant: "muted", label: "Pending" },
    PROVISIONING: { variant: "warning", label: "Provisioning", dot: true },
    RESTARTING: { variant: "warning", label: "Restarting", dot: true },
    RUNNING_JOB: { variant: "warning", label: "Running" },
    FAILED: { variant: "destructive", label: "Failed" },
    ERROR: { variant: "destructive", label: "Error" },
    STOPPED: { variant: "muted", label: "Stopped" },
    PAUSED: { variant: "muted", label: "Paused" },
    ARCHIVED: { variant: "muted", label: "Archived" },
    DEGRADED: { variant: "warning", label: "Degraded", dot: true },
    MAINTENANCE: { variant: "secondary", label: "Maintenance" },
    CANCELLED: { variant: "muted", label: "Cancelled" },
    ROLLED_BACK: { variant: "secondary", label: "Rolled Back" },
    SUSPENDED: { variant: "destructive", label: "Suspended" },
    EXPIRED: { variant: "destructive", label: "Expired" },
  };
  const entry = map[status] ?? { variant: "muted" as const, label: status };
  return (
    <Badge variant={entry.variant} dot={entry.dot}>
      {entry.label}
    </Badge>
  );
}

export { Badge, badgeVariants };
