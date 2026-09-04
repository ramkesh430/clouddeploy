import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function BillingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">Plan, usage-based charges, payment methods and invoices.</p>
      </div>
      <ComingSoon
        title="Stripe Billing"
        description="Checkout, plan upgrades/downgrades, payment methods and invoice history are wired up once the billing package lands in Phase 2."
      />
    </div>
  );
}
