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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
          <p className="text-sm text-muted-foreground">Managed PostgreSQL, MySQL, MariaDB, MongoDB and Redis.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Create Database
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a managed database</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Database Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-database" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Engine</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {["POSTGRESQL", "MYSQL", "MARIADB", "MONGODB"].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEngine(e)}
                      className={`rounded-md border px-3 py-2 text-sm ${engine === e ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      {e === "POSTGRESQL" ? "PostgreSQL" : e === "MYSQL" ? "MySQL" : e === "MARIADB" ? "MariaDB" : "MongoDB"}
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
                    {
                      onSuccess: () => {
                        setOpen(false);
                        setName("");
                      },
                    },
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
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="No Databases"
              description="Create your first database."
              action={{ label: "Create Database", href: "#", icon: Plus }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Region</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Storage</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(databases ?? []).map((db) => (
                    <tr key={db.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <Link href={`/databases/${db.id}`} className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <DatabaseIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium hover:text-primary">{db.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {db.engine} {db.version}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{db.region}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={db.status} />
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatBytes(db.storageUsedMb * 1024 * 1024)} /{" "}
                        {formatBytes(db.storageMb * 1024 * 1024)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{formatRelativeTime(db.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/databases/${db.id}`}>Manage</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
