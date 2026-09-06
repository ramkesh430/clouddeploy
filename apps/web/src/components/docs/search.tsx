"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { DOCS_PAGES, docHref } from "@/lib/docs-content";

interface Match {
  slug: string;
  pageTitle: string;
  sectionId: string;
  heading: string;
  snippet: string;
}

function buildIndex(): Match[] {
  const matches: Match[] = [];
  for (const page of DOCS_PAGES) {
    for (const section of page.sections) {
      matches.push({
        slug: page.slug,
        pageTitle: page.title,
        sectionId: section.id,
        heading: section.heading,
        snippet: section.paragraphs?.[0] ?? page.description,
      });
    }
  }
  return matches;
}

const INDEX = buildIndex();

export function DocsSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return INDEX.filter(
      (m) => m.heading.toLowerCase().includes(q) || m.pageTitle.toLowerCase().includes(q) || m.snippet.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  const go = (m: Match) => {
    router.push(docHref(m.slug, m.sectionId));
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-sidebar-foreground">
        <Search className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) go(results[0]); }}
          placeholder="Search documentation..."
          className="w-full bg-transparent text-sm placeholder:text-sidebar-foreground/50 focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          {results.map((m) => (
            <Link
              key={`${m.slug}-${m.sectionId}`}
              href={docHref(m.slug, m.sectionId)}
              className="block border-b border-border px-3 py-2 text-left last:border-0 hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setQuery(""); setOpen(false); }}
            >
              <p className="text-xs font-medium">{m.heading}</p>
              <p className="text-[10px] text-muted-foreground">{m.pageTitle}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
