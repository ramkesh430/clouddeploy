import type { Metadata } from "next";
import { CreditCard, Github, Container, Webhook } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { CTA } from "@/components/marketing/cta";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Integrations — CloudDeploy",
  description: "GitHub, Stripe billing, outbound webhooks, and Docker — how CloudDeploy connects to the rest of your stack.",
  alternates: { canonical: "/integrations" },
};

const integrations = [
  {
    icon: Github,
    title: "GitHub",
    desc: "Connect a repository with OAuth, and CloudDeploy auto-detects your framework and redeploys on every push to your default branch.",
  },
  {
    icon: CreditCard,
    title: "Stripe",
    desc: "Subscriptions, invoices, and payment methods are billed through Stripe under the hood — you manage your plan from CloudDeploy directly.",
  },
  {
    icon: Webhook,
    title: "Outbound webhooks",
    desc: "Send deployment, build, and service events to your own systems — Slack, an internal dashboard, or anywhere else that accepts a POST request.",
  },
  {
    icon: Container,
    title: "Docker",
    desc: "Anything that runs in a container runs on CloudDeploy — bring your own Dockerfile for languages and runtimes without native buildpack support.",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="container flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-xs font-bold tracking-[0.15em] text-primary">INTEGRATIONS</p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Connects to what you already use</h1>
          <p className="max-w-lg text-sidebar-foreground/80">CloudDeploy fits into your existing workflow instead of replacing it.</p>
        </div>
      </section>

      <section className="container py-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {integrations.map((integration) => (
            <Card key={integration.title}>
              <CardContent className="flex gap-4 p-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <integration.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">{integration.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{integration.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <CTA title="Ready to start building?" />
      <MarketingFooter />
    </div>
  );
}
