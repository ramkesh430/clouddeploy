"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Copy, Users } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/store/toast-store";
import { DOCS_PAGES, type DocSection, findDocPage } from "@/lib/docs-content";
import { DocsSearch } from "./search";
import { cn } from "@/lib/utils";

const QUICK_LINKS = [
  { label: "Create an Account", href: "/register" },
  { label: "GitHub Auto Deploy", href: "/docs/deployments#auto-deploy" },
  { label: "Environment Variables", href: "/docs/environment-variables" },
  { label: "Custom Domains", href: "/docs/domains#custom-domain" },
  { label: "API Authentication", href: "/docs/api#keys" },
];

const USE_CASES = [
  { label: "Deploy a Next.js app", href: "/docs" },
  { label: "Deploy a Node.js API", href: "/docs/services#types" },
  { label: "Add a PostgreSQL database", href: "/docs/databases#engines" },
  { label: "Set up a custom domain", href: "/docs/domains#custom-domain" },
  { label: "Automate with the CLI", href: "/docs/cli" },
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

function Section({ section }: { section: DocSection }) {
  const heading = section.step ? (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {section.step}
      </div>
      <h2 className="pt-1 text-base font-semibold">{section.heading}</h2>
    </div>
  ) : (
    <h2 className="text-lg font-semibold">{section.heading}</h2>
  );

  const body = (
    <div className={section.step ? "ml-11 mt-1" : "mt-2"}>
      {section.paragraphs?.map((p, i) => (
        <p key={i} className="mt-1 text-sm text-muted-foreground">{p}</p>
      ))}
      {section.list && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {section.list.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> {item}
            </li>
          ))}
        </ul>
      )}
      {section.table && (
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                {section.table.headers.map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-muted-foreground">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.code && <CodeBlock code={section.code.code} />}
      {section.callout && (
        <div
          className={cn(
            "mt-3 rounded-md border p-3 text-xs text-muted-foreground",
            section.callout.tone === "success" && "border-success/30 bg-success/5",
            section.callout.tone === "warning" && "border-warning/30 bg-warning/5",
            section.callout.tone === "info" && "border-primary/30 bg-primary/5",
          )}
        >
          {section.callout.text}
        </div>
      )}
    </div>
  );

  return (
    <section id={section.id} className="scroll-mt-24 border-b border-border py-6 last:border-0">
      {heading}
      {body}
    </section>
  );
}

export function DocsShell({ slug }: { slug: string }) {
  const pathname = usePathname();
  // DOCS_PAGES contains Lucide icon *components*, which can't cross the
  // server/client boundary as a prop (React can't serialize a function
  // reference) — so this client component takes a plain string slug and
  // looks the page up itself from its own client-side import, rather than
  // the server route resolving it and passing the object down.
  const page = findDocPage(slug) ?? DOCS_PAGES[0]!;

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <div className="bg-sidebar text-sidebar-foreground">
        <div className="container flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Documentation</h1>
            <p className="mt-1 text-sm text-sidebar-foreground/80">Everything you need to build, deploy, and scale with CloudDeploy.</p>
          </div>
          <DocsSearch />
        </div>
      </div>

      <main className="container grid gap-8 py-8 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
        <aside className="hidden lg:block">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4" /> Documentation
          </div>
          <nav className="flex flex-col gap-0.5">
            {DOCS_PAGES.map((item) => {
              const href = item.slug === "getting-started" ? "/docs" : `/docs/${item.slug}`;
              const active = pathname === href;
              return (
                <Link
                  key={item.slug}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                    active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" /> {item.title}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-lg bg-primary/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Need more help?</p>
            <p className="mt-1.5 text-xs text-muted-foreground">Reach our team through the in-app support desk.</p>
            <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
              <Link href="/support">Contact Support</Link>
            </Button>
          </div>
        </aside>

        <article>
          <p className="text-xs text-muted-foreground">Docs › {page.title}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{page.title}</h1>
          <p className="mt-2 text-muted-foreground">{page.description}</p>

          <div className="mt-4">
            {page.sections.map((section) => (
              <Section key={section.id} section={section} />
            ))}
          </div>
        </article>

        <aside className="hidden lg:flex lg:flex-col lg:gap-4">
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold">On this page</h3>
            <nav className="mt-2 flex flex-col gap-1.5">
              {page.sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="text-xs text-muted-foreground hover:text-primary">
                  {s.heading}
                </a>
              ))}
            </nav>
          </div>
          <div className="rounded-lg bg-primary/5 p-4">
            <h3 className="text-sm font-semibold">Quick Links</h3>
            <nav className="mt-2 flex flex-col gap-1.5">
              {QUICK_LINKS.map((l) => (
                <Link key={l.label} href={l.href} className="text-xs text-muted-foreground hover:text-primary">{l.label}</Link>
              ))}
            </nav>
          </div>
          <div className="rounded-lg bg-success/5 p-4">
            <h3 className="text-sm font-semibold">Common Use Cases</h3>
            <nav className="mt-2 flex flex-col gap-1.5">
              {USE_CASES.map((l) => (
                <Link key={l.label} href={l.href} className="text-xs text-muted-foreground hover:text-primary">{l.label}</Link>
              ))}
            </nav>
          </div>
        </aside>
      </main>

      <MarketingFooter />
    </div>
  );
}
