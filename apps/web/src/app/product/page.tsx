import type { Metadata } from "next";
import {
  BarChart3,
  Code2,
  Cog,
  Database,
  Github,
  Globe2,
  HardDrive,
  Image as ImageIcon,
  Server,
  Zap,
} from "lucide-react";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { CTA } from "@/components/marketing/cta";
import { toneClass } from "@/components/marketing/tone";

export const metadata: Metadata = {
  title: "Product — CloudDeploy",
  description: "One platform for your entire stack: full-stack deployments, managed databases, object storage, custom domains with SSL, and real-time monitoring.",
  alternates: { canonical: "/product" },
};

const blocks = [
  { icon: Zap, title: "Full Stack Deployments", desc: "Deploy frontend, backend, database and more — with one click." },
  { icon: Database, title: "Managed Databases", desc: "PostgreSQL, MySQL, MariaDB and more. Automated backups and scaling." },
  { icon: Cog, title: "Background Workers & Cron Jobs", desc: "Run background jobs, cron tasks and queues with ease." },
  { icon: HardDrive, title: "Object Storage", desc: "S3-compatible storage for files, media and more." },
  { icon: Globe2, title: "Domains & SSL", desc: "Connect custom domains and get free SSL certificates automatically." },
  { icon: BarChart3, title: "Observability & Logs", desc: "Real-time logs, metrics and monitoring across all your services." },
  { icon: Github, title: "GitHub Auto Deploy", desc: "Connect your repository and deploy automatically on every push." },
  { icon: Server, title: "Team Collaboration", desc: "Invite your team, manage access and deploy together." },
  { icon: Zap, title: "AI Deployment Assistant", desc: "Get intelligent suggestions for your stack, configuration and scaling." },
];

const support = [
  { icon: ImageIcon, title: "Static Sites", desc: "Marketing sites, docs, blogs", detail: "HTML, React, Next.js, Vue" },
  { icon: Server, title: "Web Services", desc: "Full stack web applications", detail: "Node.js, Python, Ruby, Go" },
  { icon: Code2, title: "APIs", desc: "REST & GraphQL APIs", detail: "Express, FastAPI, Django" },
  { icon: Cog, title: "Workers", desc: "Background jobs & queues", detail: "Celery, BullMQ, Sidekiq" },
  { icon: Database, title: "Databases", desc: "Managed databases", detail: "PostgreSQL, MySQL, MariaDB" },
  { icon: HardDrive, title: "Storage", desc: "Object storage", detail: "S3 compatible" },
];

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <Hero
        eyebrow="THE CLOUDDEPLOY PLATFORM"
        title={<>Everything you need to deploy your <span className="text-primary">full stack app</span></>}
        subtitle="Frontend, backend, database, storage, domains, SSL, logs, monitoring, background workers and Docker support — all in one powerful platform."
      />

      <section className="container py-16">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <p className="text-xs font-bold tracking-[0.15em] text-primary">POWERFUL BUILDING BLOCKS</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">A complete platform for modern development</h2>
          <p className="mt-2 text-muted-foreground">Everything works together seamlessly, so you can focus on building great products.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((b, i) => (
            <div key={b.title} className="flex items-start gap-3 rounded-lg border border-border p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneClass(i)}`}>
                <b.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{b.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
              </div>
              <span className="self-center text-lg text-primary">→</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-16">
        <div className="container">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <p className="text-xs font-bold tracking-[0.15em] text-primary">DEPLOY ANYTHING</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Support for every type of application</h2>
            <p className="mt-2 text-muted-foreground">From static sites to complex distributed systems, CloudDeploy has you covered.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {support.map((s, i) => (
              <div key={s.title} className="rounded-lg border border-border bg-background p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClass(i)}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                <span className="mt-3 inline-block rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{s.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTA />
      <MarketingFooter />
    </div>
  );
}
