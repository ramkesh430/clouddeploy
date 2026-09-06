"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Braces,
  CircleHelp,
  Copy,
  CreditCard,
  Database,
  Globe2,
  HardDrive,
  Layers3,
  Rocket,
  ShieldCheck,
  Terminal,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/store/toast-store";

const docsNav = [
  { label: "Getting Started", icon: Rocket },
  { label: "Deployments", icon: Layers3 },
  { label: "Databases", icon: Database },
  { label: "Storage", icon: HardDrive },
  { label: "Domains", icon: Globe2 },
  { label: "Environment Variables", icon: Braces },
  { label: "Monitoring", icon: BarChart3 },
  { label: "Billing", icon: CreditCard },
  { label: "API", icon: Workflow },
  { label: "CLI", icon: Terminal },
  { label: "Troubleshooting", icon: CircleHelp },
];

const badges = [
  { icon: Zap, title: "Deploy in minutes", desc: "From code to live URL" },
  { icon: Layers3, title: "All-in-one platform", desc: "Frontend, backend, database & more" },
  { icon: Users, title: "Developer friendly", desc: "Simple, powerful tools" },
  { icon: ShieldCheck, title: "Production ready", desc: "Built for scale" },
];

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-lg bg-[#0b0f19] text-[#d1d5db]">
      <div className="flex items-center justify-between bg-white/5 px-3 py-1.5 text-xs text-white/50">
        <span>bash</span>
        <button
          className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-white hover:bg-white/20"
          onClick={() => { navigator.clipboard.writeText(code); toast({ title: "Copied" }); }}
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
      <pre className="whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed">{code}</pre>
    </div>
  );
}

function DocStep({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</div>
      <div className="flex-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default function DocsPage() {
  const [active] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <div className="bg-sidebar text-sidebar-foreground">
        <div className="container py-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Documentation</h1>
          <p className="mt-1 text-sm text-sidebar-foreground/80">Everything you need to build, deploy, and scale with CloudDeploy.</p>
        </div>
      </div>

      <main className="container grid gap-8 py-8 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
        <aside className="hidden lg:block">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4" /> Documentation
          </div>
          <nav className="flex flex-col gap-0.5">
            {docsNav.map((item, i) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm ${i === active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </div>
            ))}
          </nav>
          <div className="mt-8 rounded-lg bg-primary/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Need more help?</p>
            <p className="mt-1.5 text-xs text-muted-foreground">Join our community of developers on Discord or GitHub.</p>
            <Button size="sm" variant="outline" className="mt-3 w-full">Join Community</Button>
          </div>
        </aside>

        <article>
          <p className="text-xs text-muted-foreground">Docs › Getting Started › Introduction</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Getting Started</h1>
          <p className="mt-2 text-muted-foreground">
            Deploy your first application in minutes with CloudDeploy. This guide takes you from zero to production
            with a simple web application.
          </p>

          <div className="mt-6 grid gap-3 border-b border-border pb-6 sm:grid-cols-2 lg:grid-cols-4">
            {badges.map((b) => (
              <div key={b.title} className="flex items-start gap-2">
                <b.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <DocStep n="1" title="Create an account">
            <p className="mt-1 text-sm text-muted-foreground">First, create a free CloudDeploy account. No credit card required.</p>
            <Button className="mt-3" asChild>
              <Link href="/register">Start Free →</Link>
            </Button>
          </DocStep>

          <DocStep n="2" title="Install the CLI (optional)">
            <p className="mt-1 text-sm text-muted-foreground">
              The CloudDeploy CLI lets you deploy and manage your applications from your terminal.
            </p>
            <CodeBlock code={"npm install -g @clouddeploy/cli\n\nclouddeploy login --api-key <your-api-key>"} />
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
              <b className="text-foreground">Note</b> — create an API key from your dashboard under Settings → API
              Keys. You can also deploy directly by connecting GitHub in the dashboard without installing the CLI.
            </div>
          </DocStep>

          <DocStep n="3" title="Deploy your application">
            <p className="mt-1 text-sm text-muted-foreground">
              Once your project exists (created via the dashboard or <code className="rounded bg-muted px-1 py-0.5">clouddeploy init</code>),
              trigger a new deployment for it directly from the CLI.
            </p>
            <CodeBlock code={"clouddeploy deploy --project <project-id>\n\n# Stream live logs for a deployment\nclouddeploy logs <deployment-id> --follow"} />
            <div className="rounded-md border border-success/30 bg-success/5 p-3 text-xs text-muted-foreground">
              ✓ Your application builds and deploys to a live URL — watch progress in the dashboard or via
              <code className="mx-1 rounded bg-muted px-1 py-0.5">clouddeploy logs</code>.
            </div>
          </DocStep>

          <DocStep n="4" title="Visit your live application">
            <p className="mt-1 text-sm text-muted-foreground">
              Once the deployment is live, open the generated production URL from your project&apos;s Overview page.
            </p>
          </DocStep>
        </article>

        <aside className="hidden lg:flex lg:flex-col lg:gap-4">
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold">On this page</h3>
            <div className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-primary">Getting Started</span>
              <span>1. Create an account</span>
              <span>2. Install the CLI</span>
              <span>3. Deploy your application</span>
              <span>4. Visit your application</span>
            </div>
          </div>
          <div className="rounded-lg bg-primary/5 p-4">
            <h3 className="text-sm font-semibold">Quick Links</h3>
            <div className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
              <span>Create an Account</span>
              <span>GitHub Integration</span>
              <span>Supported Frameworks</span>
              <span>Environment Variables</span>
              <span>Custom Domains</span>
            </div>
          </div>
          <div className="rounded-lg bg-success/5 p-4">
            <h3 className="text-sm font-semibold">Common Use Cases</h3>
            <div className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
              <span>Deploy a Next.js app</span>
              <span>Deploy a Node.js API</span>
              <span>Add a PostgreSQL database</span>
              <span>Set up a custom domain</span>
            </div>
          </div>
        </aside>
      </main>

      <MarketingFooter />
    </div>
  );
}
