import Link from "next/link";
import {
  ArrowRight,
  Github,
  Database,
  Server,
  HardDrive,
  Globe,
  ShieldCheck,
  Terminal,
  Activity,
  Bot,
  Users,
  Boxes,
  Container,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { CTA } from "@/components/marketing/cta";

const stack = [
  { icon: Globe, title: "Frontend", desc: "React, Next.js, Vue" },
  { icon: Server, title: "Backend", desc: "Node.js, Python, PHP" },
  { icon: Database, title: "Database", desc: "PostgreSQL, MySQL" },
  { icon: HardDrive, title: "Storage", desc: "S3, Files, Backups" },
  { icon: Container, title: "Any Language", desc: "Via Docker" },
];

const features = [
  { icon: Boxes, title: "Full-Stack Deployments", desc: "Frontend, backend, database and Redis deployed together as one application, not four separate providers." },
  { icon: Database, title: "Managed Databases", desc: "PostgreSQL, MySQL, MariaDB and Redis with automatic backups, SQL editor, and connection pooling." },
  { icon: Server, title: "Universal Docker Support", desc: "Ship any Dockerfile — Node, Python, PHP, Java, Go, .NET, Ruby, Rust — Docker is the universal fallback." },
  { icon: ShieldCheck, title: "Automatic SSL", desc: "Every domain — platform or custom — gets a Let's Encrypt certificate with automatic renewal." },
  { icon: Github, title: "GitHub Auto Deploy", desc: "Push to your branch and CloudDeploy builds and ships automatically, with rollback if health checks fail." },
  { icon: Terminal, title: "Live Logs", desc: "Watch clone, build, and deploy logs stream in real time — searchable, downloadable, pausable." },
  { icon: Activity, title: "Monitoring", desc: "CPU, RAM, disk, bandwidth, latency and error rate for every service, out of the box." },
  { icon: HardDrive, title: "Object Storage", desc: "S3-compatible buckets with signed URLs, public/private visibility, and CORS controls." },
  { icon: Users, title: "Team Collaboration", desc: "Invite teammates with scoped roles — owner, admin, developer, billing manager, viewer." },
  { icon: Bot, title: "AI Deployment Assistant", desc: "Ask it to deploy your stack, explain a failed build, or recommend the right resources." },
  { icon: Globe, title: "Custom Domains", desc: "Connect any domain with guided DNS setup and one-click verification." },
  { icon: ShieldCheck, title: "Backups", desc: "Automatic and manual database backups with configurable retention, restorable in one click." },
];

const flowSteps = [
  { step: "01", title: "Connect GitHub", desc: "Authorize CloudDeploy to read your repositories." },
  { step: "02", title: "Detect & Configure", desc: "We detect your frontend, backend, database and Redis needs." },
  { step: "03", title: "Build & Deploy", desc: "Docker images are built and shipped to isolated runtime nodes." },
  { step: "04", title: "Live in Minutes", desc: "Get production URLs, SSL, monitoring and logs — instantly." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <section className="bg-sidebar text-sidebar-foreground">
        <div className="container flex flex-col items-center gap-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-sidebar-foreground/70">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> A complete application cloud
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Deploy Your Entire Application
          </h1>
          <p className="text-xl font-medium text-primary sm:text-2xl">Frontend + Backend + Database</p>
          <p className="max-w-xl text-balance text-lg text-sidebar-foreground/70">
            From GitHub to production in one click.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/register">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
              <Link href="/docs">
                <PlayCircle className="h-4 w-4" /> View Demo
              </Link>
            </Button>
          </div>

          <div className="mt-6 w-full max-w-4xl">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container grid grid-cols-2 gap-6 py-10 sm:grid-cols-5">
          {stack.map((s) => (
            <div key={s.title} className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <s.icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container grid gap-8 py-16 sm:grid-cols-4">
          {flowSteps.map((f) => (
            <div key={f.step} className="flex flex-col gap-2">
              <span className="text-xs font-mono text-primary">{f.step}</span>
              <h3 className="text-sm font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="container py-20">
        <div className="mb-10 max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything managed inside CloudDeploy</h2>
          <p className="mt-2 text-muted-foreground">
            No separate providers for frontend, backend, database, Redis, storage, SSL, domains, monitoring, logs, or backups.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <f.icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <CTA />

      <MarketingFooter />
    </div>
  );
}
