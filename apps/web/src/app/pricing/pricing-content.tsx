"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { CTA } from "@/components/marketing/cta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePlans, type Plan } from "@/hooks/use-billing";
import { cn, formatCurrency } from "@/lib/utils";

const PLAN_TAGLINES: Record<string, string> = {
  FREE: "Perfect for hobby projects and learning.",
  DEVELOPER: "For individual developers and side projects.",
  PRO: "For professional developers and small teams.",
  BUSINESS: "For growing teams and businesses.",
  ENTERPRISE: "For large teams with advanced needs.",
};

const NUMERIC_FEATURE_LABELS: Record<string, string> = {
  maxDatabases: "databases",
  maxTeamMembers: "team members",
  maxStorageGb: "GB storage",
  maxBandwidthGb: "GB bandwidth / month",
};

function formatCount(n: number): string {
  return n >= 10_000 ? "Unlimited" : String(n);
}

function planBullets(plan: Plan): string[] {
  const bullets = [
    `${formatCount(plan.maxProjects)} project${plan.maxProjects === 1 ? "" : "s"}`,
    `${plan.maxRamMb >= 10_000 ? "Unlimited" : plan.maxRamMb} MB RAM`,
  ];
  for (const [key, label] of Object.entries(NUMERIC_FEATURE_LABELS)) {
    const value = plan.features[key];
    if (typeof value === "number") bullets.push(`${formatCount(value)} ${label}`);
  }
  for (const [key, value] of Object.entries(plan.features)) {
    if (value === true) bullets.push(key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim());
  }
  return bullets;
}

const comparisonRows: { label: string; get: (p: Plan) => string }[] = [
  { label: "Projects", get: (p) => formatCount(p.maxProjects) },
  { label: "RAM", get: (p) => (p.maxRamMb >= 10_000 ? "Unlimited" : `${p.maxRamMb} MB`) },
  { label: "Databases", get: (p) => (typeof p.features.maxDatabases === "number" ? formatCount(p.features.maxDatabases) : "—") },
  { label: "Storage", get: (p) => (typeof p.features.maxStorageGb === "number" ? `${formatCount(p.features.maxStorageGb)} GB` : "—") },
  { label: "Team members", get: (p) => (typeof p.features.maxTeamMembers === "number" ? formatCount(p.features.maxTeamMembers) : "—") },
  { label: "AI deployment assistant", get: (p) => (p.features.aiAssistant ? "✓" : "—") },
  { label: "Priority support", get: (p) => (p.features.prioritySupport ? "✓" : "—") },
];

const faqs = [
  { q: "Do I need a credit card to start?", a: "No — you can start with the Free plan without a credit card and upgrade anytime when you need more resources." },
  { q: "Can I change my plan later?", a: "Yes. You can upgrade or downgrade your subscription at any time from your billing settings." },
  { q: "What happens if I exceed my limits?", a: "We'll notify you before limits are reached and help you upgrade before it affects your projects." },
  { q: "Is there a discount for yearly billing?", a: "Yes — every plan supports annual billing at a reduced effective monthly rate." },
  { q: "Do you offer refunds?", a: "Contact support and we'll review refund requests on a case-by-case basis." },
  { q: "Do you have special pricing for non-profits or students?", a: "Contact our team to ask about available education and nonprofit programs." },
];

export function PricingContent() {
  const { data: rawPlans, isLoading } = usePlans();
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  // "Custom pricing" plans store 0 cents (there's no real price to sort by),
  // which ties them with Free under the API's plain ascending sort — always
  // display those last regardless of that sentinel value.
  const plans = rawPlans
    ? [...rawPlans].sort((a, b) => {
        const aPrice = a.tier === "ENTERPRISE" ? Number.POSITIVE_INFINITY : a.priceMonthlyCents;
        const bPrice = b.tier === "ENTERPRISE" ? Number.POSITIVE_INFINITY : b.priceMonthlyCents;
        return aPrice - bPrice;
      })
    : rawPlans;

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <section className="bg-sidebar text-sidebar-foreground">
        <div className="container flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-xs font-bold tracking-[0.15em] text-primary">PRICING FOR EVERY BUILDER</p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Simple, transparent <span className="text-primary">pricing</span>
          </h1>
          <p className="max-w-lg text-sidebar-foreground/80">Start free and scale as you grow. No hidden fees. No credit card required.</p>
          <div className="mt-2 flex items-center gap-1 rounded-full bg-white/10 p-1 text-sm">
            <button onClick={() => setYearly(false)} className={cn("rounded-full px-4 py-2 transition-colors", !yearly ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/80")}>
              Monthly
            </button>
            <button onClick={() => setYearly(true)} className={cn("rounded-full px-4 py-2 transition-colors", yearly ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/80")}>
              Yearly
            </button>
            <span className="ml-1 rounded-full bg-success/20 px-2.5 py-1 text-xs font-bold text-success">Save up to 20%</span>
          </div>
        </div>
      </section>

      <section className="container -mt-10 pb-16">
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading plans…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {(plans ?? []).map((plan) => {
              const isEnterprise = plan.tier === "ENTERPRISE";
              const isPopular = plan.tier === "PRO";
              const priceCents = yearly ? Math.round(plan.priceYearlyCents / 12) : plan.priceMonthlyCents;
              return (
                <Card key={plan.id} className={cn("relative flex flex-col", isPopular && "border-primary shadow-lg")}>
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-primary-foreground">
                      Most Popular
                    </span>
                  )}
                  <CardContent className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="mt-1 min-h-[32px] text-xs text-muted-foreground">{PLAN_TAGLINES[plan.tier] ?? ""}</p>
                    {isEnterprise ? (
                      <p className="my-2 text-2xl font-bold">Custom pricing</p>
                    ) : (
                      <p className="my-2 text-3xl font-bold tracking-tight">
                        {formatCurrency(priceCents / 100)}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                    )}
                    <ul className="mt-2 flex flex-1 flex-col gap-2 text-xs">
                      {planBullets(plan).map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button className="mt-4" variant={isPopular ? "default" : "outline"} asChild>
                      <Link href={isEnterprise ? "/contact?plan=enterprise" : "/register"}>
                        {isEnterprise ? "Contact Sales" : "Start Free"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-base font-semibold">Feature Comparison</h3>
              <p className="mt-1 text-xs text-muted-foreground">A detailed look at what&apos;s included in each plan.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Feature</th>
                      {(plans ?? []).map((p) => (
                        <th key={p.id} className="p-2 text-center font-medium">{p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.label} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-2 font-medium">{row.label}</td>
                        {(plans ?? []).map((p) => (
                          <td key={p.id} className="p-2 text-center text-muted-foreground">{row.get(p)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="text-base font-semibold">Frequently asked questions</h3>
              <p className="mt-1 text-xs text-muted-foreground">Everything you need to know about CloudDeploy pricing.</p>
              <div className="mt-3 flex flex-col gap-2">
                {faqs.map((faq, i) => (
                  <div key={faq.q} className="rounded-md border border-border p-3">
                    <button className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                      {faq.q}
                      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", openFaq === i && "rotate-180")} />
                    </button>
                    {openFaq === i && <p className="mt-2 text-xs text-muted-foreground">{faq.a}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <CTA title="Ready to start building?" />
      <MarketingFooter />
    </div>
  );
}
