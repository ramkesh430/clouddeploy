"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Database as DatabaseIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useDatabases, useCreateDatabase } from "@/hooks/use-databases";
import { formatBytes, formatRelativeTime } from "@/lib/utils";

export default function DatabasesPage() {
  const { active } = useActiveOrganization();
  const { data: databases, isLoading } = useDatabases(active?.id ?? null);
  const createDatabase = useCreateDatabase();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [engine, setEngine] = useState("POSTGRESQL");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Databases</h1>
          <p className="text-sm text-muted-foreground">Managed PostgreSQL, MySQL, MariaDB and Redis.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Create Database</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a managed database</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Database Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-database" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Engine</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["POSTGRESQL", "MYSQL", "MARIADB"].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEngine(e)}
                      className={`rounded-md border px-3 py-2 text-sm ${engine === e ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      {e === "POSTGRESQL" ? "PostgreSQL" : e === "MYSQL" ? "MySQL" : "MariaDB"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                loading={createDatabase.isPending}
                onClick={() =>
                  active &&
                  createDatabase.mutate(
                    { organizationId: active.id, name, engine },
                    { onSuccess: () => { setOpen(false); setName(""); } },
                  )
                }
              >
                Create Database
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!isLoading && (databases ?? []).length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState title="No Databases" description="Create your first database." action={{ label: "Create Database", href: "#", icon: Plus }} /></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col p-0">
            {(databases ?? []).map((db) => (
              <div key={db.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <DatabaseIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{db.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{db.engine} {db.version} · {db.region}</p>
                </div>
                <StatusBadge status={db.status} />
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {formatBytes(db.storageUsedMb * 1024 * 1024)} / {formatBytes(db.storageMb * 1024 * 1024)}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">{formatRelativeTime(db.createdAt)}</span>
                <Button variant="ghost" size="sm" className="shrink-0" asChild>
                  <Link href={`/databases/${db.id}`}>Manage</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
