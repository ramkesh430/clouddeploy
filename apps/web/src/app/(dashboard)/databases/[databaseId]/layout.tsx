"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/tables", label: "Tables" },
  { href: "/sql-editor", label: "SQL Editor" },
  { href: "/backups", label: "Backups" },
  { href: "/users", label: "Users" },
  { href: "/connections", label: "Connections" },
];

export default function DatabaseLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ databaseId: string }>();
  const pathname = usePathname();
  const { data: database, isLoading } = useQuery({
    queryKey: ["database", params.databaseId],
    queryFn: () => api.get<any>(`/databases/${params.databaseId}`),
  });

  const basePath = `/databases/${params.databaseId}`;

  if (isLoading || !database) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{database.name}</h1>
          <StatusBadge status={database.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          {database.engine} {database.version} · {database.region}
        </p>
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const href = `${basePath}${tab.href}`;
            const active = pathname === href;
            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
