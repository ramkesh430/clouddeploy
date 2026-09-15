"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import type { DashboardSummary } from "@/hooks/use-dashboard";

const DISMISS_KEY = "clouddeploy-onboarding-dismissed";

interface ChecklistStep {
  label: string;
  done: boolean;
  href: string;
}

/** Every step reflects real account state — no step is ever marked done
 * just because the widget rendered. Disappears once every step is
 * complete, or if the user dismisses it early. */
export function OnboardingChecklist({ summary }: { summary: DashboardSummary }) {
  const { active } = useActiveOrganization();
  const [dismissed, setDismissed] = useState(true);
  const { data: domains } = useQuery({
    queryKey: ["domains", active?.id],
    queryFn: () => api.get<{ data: unknown[] }>(`/domains?organizationId=${active?.id}`),
    enabled: !!active?.id,
  });

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const steps: ChecklistStep[] = [
    { label: "Deploy your first project", done: summary.stats.totalProjects > 0, href: "/projects/new" },
    { label: "Ship a successful deployment", done: summary.recentProjects.some((p) => !!p.lastDeployAt), href: "/projects" },
    { label: "Add a custom domain", done: ((domains?.data?.length ?? 0) > 0), href: "/domains" },
    { label: "Invite your team", done: (active?._count?.members ?? 1) > 1, href: "/team" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (dismissed || doneCount === steps.length) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Per-viewer convenience only — fine if it doesn't persist.
    }
  }

  return (
    <Card className="relative">
      <button onClick={dismiss} aria-label="Dismiss" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between pr-6">
          <h2 className="text-sm font-semibold">Get started with CloudDeploy</h2>
          <span className="text-xs text-muted-foreground">{doneCount}/{steps.length} complete</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {steps.map((step) => (
            <Link
              key={step.label}
              href={step.href}
              className={`flex items-center gap-2.5 rounded-md border p-3 text-sm transition-colors ${step.done ? "border-success/30 bg-success/5 text-muted-foreground" : "hover:bg-accent"}`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${step.done ? "bg-success text-success-foreground" : "border border-muted-foreground/30"}`}>
                {step.done && <Check className="h-3 w-3" />}
              </span>
              <span className={step.done ? "line-through" : ""}>{step.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
