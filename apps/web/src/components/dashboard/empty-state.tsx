import Link from "next/link";
import { PackageOpen, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: { label: string; href: string; icon?: LucideIcon };
}

export function EmptyState({ title, description, icon: Icon = PackageOpen, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button size="sm" asChild className="mt-1">
          <Link href={action.href}>
            {action.icon && <action.icon className="h-4 w-4" />}
            {action.label}
          </Link>
        </Button>
      )}
    </div>
  );
}
