import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Database, Globe2, Layers3, Rocket, Users } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { CTA } from "@/components/marketing/cta";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Use Cases — CloudDeploy",
  description: "How teams use CloudDeploy to ship full-stack applications, SaaS backends, agency client sites, and side projects.",
  alternates: { canonical: "/use-cases" },
};

const useCases = [
  {
    icon: Rocket,
    title: "Full-stack web apps",
    desc: "Deploy a Next.js, React, or Vue frontend alongside its API and database as one project — connect a repo and CloudDeploy detects the stack.",
  },
  {
    icon: Database,
    title: "SaaS backends",
    desc: "Managed Postgres, MySQL, and Redis with connection pooling, backups, and a built-in SQL editor for the data layer behind a production API.",
  },
  {
    icon: Users,
    title: "Agencies with multiple clients",
    desc: "Agency mode groups client organizations under one account, with per-client branding, billing, and access — without giving clients your login.",
  },
  {
    icon: Globe2,
    title: "Multi-region APIs",
    desc: "Route traffic across regions and autoscale runtime capacity to the services that need it, without hand-managing infrastructure per region.",
  },
  {
    icon: Layers3,
    title: "Microservices",
    desc: "Run several services per project — a web frontend, a background worker, and a database — each independently deployable from the same repo.",
  },
  {
    icon: Boxes,
    title: "Side projects and prototypes",
    desc: "Start on the free plan with no credit card, and deploy from a template in the marketplace to skip the boilerplate entirely.",
  },
];

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="container flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-xs font-bold tracking-[0.15em] text-primary">USE CASES</p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Built for how you ship</h1>
          <p className="max-w-lg text-sidebar-foreground/80">From a weekend project to a multi-client agency practice.</p>
        </div>
      </section>

      <section className="container py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase) => (
            <Card key={useCase.title}>
              <CardContent className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <useCase.icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-base font-semibold">{useCase.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{useCase.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Want to see how it fits your stack?{" "}
          <Link href="/contact" className="font-medium text-primary hover:underline">
            Talk to us
          </Link>
          .
        </p>
      </section>

      <CTA title="Ready to start building?" />
      <MarketingFooter />
    </div>
  );
}
