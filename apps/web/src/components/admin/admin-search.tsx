"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { ADMIN_SEARCH_INDEX } from "./admin-nav-index";

export function AdminSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ADMIN_SEARCH_INDEX.filter((item) => item.label.toLowerCase().includes(q) || item.section.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  const go = (href: string) => {
    router.push(href);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative hidden w-full max-w-[380px] md:block">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && results[0]) go(results[0].href); }}
        placeholder="Search users, projects, deployments..."
        className="h-8 w-full rounded-md border border-[#20313e] bg-[#101e28] pl-10 pr-16 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400">⌘K</span>

      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-md border border-[#20313e] bg-[#101e28] shadow-xl">
          {results.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block border-b border-[#20313e] px-4 py-2.5 text-left last:border-0 hover:bg-slate-800"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setQuery(""); setOpen(false); }}
            >
              <p className="text-sm text-white">{item.label}</p>
              <p className="text-xs text-slate-500">{item.section}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
