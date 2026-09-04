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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold">CloudDeploy</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link href="#features" className="hover:text-foreground">Features</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/docs" className="hover:text-foreground">Documentation</Link>
            <Link href="/status" className="hover:text-foreground">Status</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="container flex flex-col items-center gap-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> A complete application cloud
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Deploy Your Entire Application
          </h1>
          <p className="max-w-xl text-balance text-lg text-muted-foreground">
            Frontend, backend, database, storage, domains and SSL — all from one cloud platform. One deploy, not four providers.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/register">
                Deploy Your First Project <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/docs">Explore Documentation</Link>
            </Button>
          </div>

          <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {["Frontend", "Backend", "Database", "Storage"].map((s, i) => (
              <Card key={s} className="animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 80}ms` }}>
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  {[Globe, Server, Database, HardDrive][i] &&
                    (() => {
                      const Icon = [Globe, Server, Database, HardDrive][i];
                      return <Icon className="h-5 w-5 text-primary" />;
                    })()}
                  <span className="text-xs font-medium text-muted-foreground">{s}</span>
                </CardContent>
              </Card>
            ))}
          </div>
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

      <section className="border-y border-border bg-muted/30">
        <div className="container flex flex-col items-center gap-4 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to deploy your entire application?</h2>
          <p className="max-w-lg text-muted-foreground">Start free — no credit card required. Upgrade when you need more.</p>
          <Button size="lg" asChild>
            <Link href="/register">Get Started Free <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <footer className="container flex flex-col items-center justify-between gap-4 py-10 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} CloudDeploy. All rights reserved.</span>
        <div className="flex gap-6">
          <Link href="/docs" className="hover:text-foreground">Docs</Link>
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/status" className="hover:text-foreground">Status</Link>
        </div>
      </footer>
    </div>
  );
}
