"use client";

import { Check, CreditCard, ExternalLink, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { usePlans, useBillingSummary, useCheckout, useBillingPortal } from "@/hooks/use-billing";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";

export default function BillingPage() {
  const { active } = useActiveOrganization();
  const { data: plans } = usePlans();
  const { data: summary } = useBillingSummary(active?.id ?? null);
  const checkout = useCheckout(active?.id ?? null);
  const portal = useBillingPortal(active?.id ?? null);

  const currentTier = summary?.subscription?.plan.tier;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">Plan, usage, payment methods and invoices.</p>
        </div>
        {summary?.subscription && (
          <Button variant="outline" onClick={() => portal.mutate()} loading={portal.isPending}>
            <CreditCard className="h-4 w-4" /> Manage Billing
          </Button>
        )}
      </div>

      {!summary?.billingConfigured && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning-foreground">
            Billing is running in demo mode — Stripe keys aren&apos;t configured in this environment, so checkout will show an error. All plan data below is real; only the payment step needs live Stripe credentials.
          </CardContent>
        </Card>
      )}

      {summary?.subscription && (
        <Card>
          <CardHeader><CardTitle>Current Plan</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">{summary.subscription.plan.name}</p>
              <p className="text-sm text-muted-foreground">
                {summary.subscription.billingPeriod === "yearly" ? "Billed yearly" : "Billed monthly"}
                {summary.subscription.currentPeriodEnd && ` · renews ${formatRelativeTime(summary.subscription.currentPeriodEnd)}`}
              </p>
            </div>
            <StatusBadge status={summary.subscription.status} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(plans ?? []).map((plan) => (
          <Card key={plan.id} className={plan.tier === currentTier ? "border-primary" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {plan.name}
                {plan.tier === currentTier && <Badge variant="success">Current</Badge>}
              </CardTitle>
              <p className="text-2xl font-semibold">
                {plan.priceMonthlyCents === 0 ? "Free" : formatCurrency(plan.priceMonthlyCents / 100)}
                {plan.priceMonthlyCents > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-success" /> {plan.maxProjects} projects</li>
                <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-success" /> {plan.maxRamMb} MB RAM</li>
                {Object.entries(plan.features)
                  .filter(([, v]) => v)
                  .slice(0, 3)
                  .map(([k]) => (
                    <li key={k} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-success" /> {k.replace(/([A-Z])/g, " $1").toLowerCase()}
                    </li>
                  ))}
              </ul>
              {plan.tier !== currentTier && plan.priceMonthlyCents > 0 && (
                <Button
                  size="sm"
                  className="mt-auto"
                  loading={checkout.isPending}
                  onClick={() => checkout.mutate({ planTier: plan.tier, billingPeriod: "monthly" })}
                >
                  Upgrade <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent className="flex flex-col p-0">
          {(summary?.invoices ?? []).map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-medium">{inv.id.slice(0, 12)}</p>
                <p className="truncate text-xs text-muted-foreground">{formatRelativeTime(inv.createdAt)}</p>
              </div>
              <span className="shrink-0 text-sm font-medium">{formatCurrency(inv.amountDueCents / 100)}</span>
              <StatusBadge status={inv.status} />
            </div>
          ))}
          {(summary?.invoices ?? []).length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
