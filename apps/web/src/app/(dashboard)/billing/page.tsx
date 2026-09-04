"use client";

import { Check, CreditCard, ExternalLink } from "lucide-react";
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
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-4 font-medium">Invoice</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.invoices ?? []).map((inv) => (
                <tr key={inv.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4 font-mono text-xs">{inv.id.slice(0, 12)}</td>
                  <td className="p-4 text-muted-foreground">{formatCurrency(inv.amountDueCents / 100)}</td>
                  <td className="p-4"><StatusBadge status={inv.status} /></td>
                  <td className="p-4 text-muted-foreground">{formatRelativeTime(inv.createdAt)}</td>
                </tr>
              ))}
              {(summary?.invoices ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
