import type { Metadata } from "next";
import { Rocket } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Changelog — CloudDeploy",
  description: "What shipped, and when — a real record of CloudDeploy's development.",
  alternates: { canonical: "/changelog" },
};

// A genuine, chronological account of what this platform actually shipped —
// grounded in the real build history, not placeholder release notes.
const entries = [
  {
    date: "2026-09-06",
    title: "Super admin platform",
    items: [
      "Full admin CRUD for users, organizations, projects, plans, servers, and status incidents",
      "Support ticket inbox, real audit logging, session management, and user impersonation for support",
      "Two-factor authentication enforcement for platform administrators",
      "Real-time abuse detection from container telemetry (CPU/RAM abuse, crypto-mining signatures, suspicious processes)",
    ],
  },
  {
    date: "2026-09-06",
    title: "Docs, marketing site, and CI",
    items: [
      "Fully functional multi-page documentation with search and navigation",
      "Rebuilt marketing site: product, features, and pricing pages wired to real plan data",
      "Frontend test suite and a continuous-integration pipeline",
      "Structured legal document templates and dormant error tracking",
    ],
  },
  {
    date: "2026-09-05",
    title: "Phase 3: scale and automation",
    items: [
      "AI deployment assistant, multi-region routing, and autoscaling policies",
      "Agency mode for managing multiple client organizations",
      "Public API, SDK, and CLI",
      "Platform status page and Redis-backed API rate limiting",
      "Templates marketplace with one-click deploy",
    ],
  },
  {
    date: "2026-09-04",
    title: "Phase 2: the full platform surface",
    items: [
      "Real Postgres, Redis, and object storage provisioning",
      "GitHub OAuth, repository import, and automatic framework detection",
      "Team roles and permissions, billing enforcement, API keys, and webhooks",
      "In-app notifications, alerting rules, and organization activity logs",
      "SQL editor, database backups, and cron jobs",
    ],
  },
  {
    date: "2026-09-04",
    title: "Phase 1: the foundation",
    items: ["Monorepo scaffold, the full platform data model, and a working auth → organization → project → deploy flow"],
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="container flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-xs font-bold tracking-[0.15em] text-primary">CHANGELOG</p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">What&apos;s new</h1>
          <p className="max-w-lg text-sidebar-foreground/80">A real record of what shipped on CloudDeploy, and when.</p>
        </div>
      </section>

      <section className="container max-w-3xl py-16">
        <div className="flex flex-col gap-10">
          {entries.map((entry) => (
            <div key={entry.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Rocket className="h-4 w-4" />
                </span>
                <span className="mt-1 w-px flex-1 bg-border" />
              </div>
              <div className="pb-2">
                <p className="text-xs font-medium text-muted-foreground">{entry.date}</p>
                <h2 className="mt-1 text-lg font-semibold">{entry.title}</h2>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {entry.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-primary">–</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
