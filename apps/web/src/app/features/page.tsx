import type { Metadata } from "next";
import {
  BarChart3,
  Boxes,
  Database,
  Github,
  Globe2,
  HardDrive,
  KeyRound,
  Layers3,
  LockKeyhole,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";

export const metadata: Metadata = {
  title: "Features — CloudDeploy",
  description: "GitHub integration, one-click deploys, managed databases and object storage, custom domains, team collaboration, API keys and webhooks, and an AI deployment assistant.",
  alternates: { canonical: "/features" },
};
import { CTA } from "@/components/marketing/cta";
import { Badge } from "@/components/ui/badge";
import { toneClass } from "@/components/marketing/tone";

const features = [
  { icon: Zap, title: "One-click Deploy", desc: "Deploy frontend, backend, databases, storage and more — in a single click.", badge: "Fast" },
  { icon: Github, title: "GitHub Integration", desc: "Connect your repositories and automatically deploy on push.", badge: "Connected" },
  { icon: Layers3, title: "Auto Stack Detection", desc: "We detect your tech stack and configure the optimal build settings.", badge: "Smart" },
  { icon: Boxes, title: "Docker Support", desc: "Deploy with Docker or let us build for you. Full container support.", badge: "Ready" },
  { icon: Database, title: "Managed PostgreSQL & MySQL", desc: "Production-ready managed databases with automated backups.", badge: "Reliable" },
  { icon: Database, title: "Redis", desc: "Managed Redis for caching, sessions and real-time apps.", badge: "High Performance" },
  { icon: HardDrive, title: "Object Storage", desc: "S3-compatible storage for files, media and backups.", badge: "Scalable" },
  { icon: Globe2, title: "Custom Domains", desc: "Use your own domain with easy DNS configuration.", badge: "Flexible" },
  { icon: LockKeyhole, title: "Automatic SSL", desc: "Free SSL certificates with automatic renewal (Let's Encrypt).", badge: "Secure" },
  { icon: TerminalSquare, title: "Live Logs", desc: "Real-time logs and debugging across all your services.", badge: "Real-time" },
  { icon: BarChart3, title: "Metrics & Monitoring", desc: "Track performance, uptime and key metrics in real time.", badge: "Insights" },
  { icon: RefreshCcw, title: "Backups", desc: "Automated backups with one-click restore.", badge: "Automatic" },
  { icon: RefreshCcw, title: "Rollbacks", desc: "Instantly rollback to any previous deployment.", badge: "Safe" },
  { icon: Rocket, title: "Preview Deployments", desc: "Create preview environments for every pull request.", badge: "Efficient" },
  { icon: Users, title: "Team Access", desc: "Invite your team, manage access and deploy together.", badge: "Collaborative" },
  { icon: KeyRound, title: "API Keys", desc: "Integrate with our API and automate your workflows.", badge: "Flexible" },
  { icon: Webhook, title: "Webhooks", desc: "Get notified of deployment events in real time.", badge: "Real-time" },
  { icon: ShieldCheck, title: "Security", desc: "Built with security best practices and isolated environments.", badge: "Enterprise Ready" },
  { icon: Sparkles, title: "AI Assistant", desc: "Get intelligent suggestions for your stack, configuration and scaling.", badge: "New" },
];

const workflow = ["Deploy", "Build", "Data", "Observe", "Collaborate"];

const stats = [
  { value: "10K+", label: "Deployments" },
  { value: "99.9%", label: "Uptime" },
  { value: "50+", label: "Frameworks" },
  { value: "Global", label: "Regions" },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <Hero
        eyebrow="FEATURES"
        title={<>Powerful features for <span className="text-primary">modern deployment teams</span></>}
        subtitle="Everything you need to build, deploy, and scale your applications — all in one platform, from code to production."
        primaryLabel="Start Free Today"
        secondaryLabel="View Demo"
      />

      <section className="container py-16">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <p className="text-xs font-bold tracking-[0.15em] text-primary">EVERYTHING YOU NEED</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Features built for developers, teams and scale</h2>
          <p className="mt-2 text-muted-foreground">CloudDeploy handles the complexity, so you can focus on building amazing products.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div key={f.title} className="relative flex items-start gap-3 rounded-lg border border-border p-4">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneClass(i)}`}>
                <f.icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
              <Badge variant="outline" className="absolute right-3 top-3 text-[10px]">{f.badge}</Badge>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-border bg-muted/40 p-6 text-center">
          <h3 className="text-base font-semibold">Features grouped for your workflow.</h3>
          <p className="mt-1 text-sm text-muted-foreground">From code to production, every step covered.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {workflow.map((w) => (
              <div key={w} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5 text-sm font-medium text-primary">
                {w} <span>→</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid items-center gap-4 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="border-border text-center sm:border-r">
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
          <blockquote className="rounded-lg border border-border p-4 text-sm text-muted-foreground sm:col-span-1">
            &ldquo;CloudDeploy has every feature we need. Deployments are smooth and the platform just works.&rdquo;
          </blockquote>
        </div>
      </section>

      <CTA title="Ready to experience all features?" />
      <MarketingFooter />
    </div>
  );
}
