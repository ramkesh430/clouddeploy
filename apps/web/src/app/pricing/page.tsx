"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    monthly: 0,
    yearly: 0,
    features: ["1 Project", "Static Sites", "512 MB shared RAM", "Free Subdomain", "Community Support"],
  },
  {
    name: "Developer",
    monthly: 5,
    yearly: 50,
    features: ["5 Projects", "Frontend + Backend", "1 Database", "Custom Domain + SSL", "Auto Deploy", "Basic Backups"],
  },
  {
    name: "Pro",
    monthly: 15,
    yearly: 150,
    highlight: true,
    features: ["20 Projects", "4 GB Total RAM", "Multiple Databases", "Redis", "Workers + Cron Jobs", "Daily Backups", "AI Assistant"],
  },
  {
    name: "Business",
    monthly: 49,
    yearly: 490,
    features: ["Team Access", "Agency Features", "Higher Resources", "Advanced Monitoring", "Priority Support"],
  },
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold">CloudDeploy</span>
          </Link>
          <Button size="sm" asChild><Link href="/register">Get Started Free</Link></Button>
        </div>
      </header>

      <div className="container flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple, transparent pricing</h1>
        <p className="max-w-lg text-muted-foreground">Start free. Upgrade as your application grows.</p>
        <div className="mt-2 flex items-center gap-3 rounded-full border border-border p-1 text-sm">
          <button onClick={() => setYearly(false)} className={cn("rounded-full px-4 py-1.5", !yearly && "bg-primary text-primary-foreground")}>Monthly</button>
          <button onClick={() => setYearly(true)} className={cn("rounded-full px-4 py-1.5", yearly && "bg-primary text-primary-foreground")}>Yearly (save ~17%)</button>
        </div>
      </div>

      <div className="container grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.name} className={cn(plan.highlight && "border-primary shadow-md")}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {plan.name}
                {plan.highlight && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Popular</span>}
              </CardTitle>
              <p className="text-3xl font-semibold">
                ${yearly ? Math.round(plan.yearly / 12) : plan.monthly}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-auto" variant={plan.highlight ? "default" : "outline"} asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardContent className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
            <div>
              <p className="font-semibold">Enterprise</p>
              <p className="text-sm text-muted-foreground">Dedicated infrastructure, private network, SLA, advanced security, white-label.</p>
            </div>
            <Button variant="outline" asChild><Link href="mailto:sales@clouddeploy.dev">Contact Sales</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
