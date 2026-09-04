"use client";

import { useState } from "react";
import { Plus, Database as DatabaseIcon, Copy, RotateCw, Save } from "lucide-react";
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
import {
  useDatabases,
  useCreateDatabase,
  useDatabaseConnection,
  useCreateBackup,
  useRotatePassword,
} from "@/hooks/use-databases";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import { toast } from "@/lib/store/toast-store";

export default function DatabasesPage() {
  const { active } = useActiveOrganization();
  const { data: databases, isLoading } = useDatabases(active?.id ?? null);
  const createDatabase = useCreateDatabase();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [engine, setEngine] = useState("POSTGRESQL");
  const [selected, setSelected] = useState<string | null>(null);

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
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="p-4 font-medium">Database</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Region</th>
                  <th className="p-4 font-medium">Storage</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Created</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(databases ?? []).map((db) => (
                  <tr key={db.id} className="border-b border-border/60 last:border-0">
                    <td className="p-4 font-medium">{db.name}</td>
                    <td className="p-4 text-muted-foreground">{db.engine} {db.version}</td>
                    <td className="p-4 text-muted-foreground">{db.region}</td>
                    <td className="p-4 text-muted-foreground">{formatBytes(db.storageUsedMb * 1024 * 1024)} / {formatBytes(db.storageMb * 1024 * 1024)}</td>
                    <td className="p-4"><StatusBadge status={db.status} /></td>
                    <td className="p-4 text-muted-foreground">{formatRelativeTime(db.createdAt)}</td>
                    <td className="p-4">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(db.id)}>
                        <DatabaseIcon className="h-3.5 w-3.5" /> Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {selected && <DatabaseDetailDialog databaseId={selected} onOpenChange={(v) => !v && setSelected(null)} />}
    </div>
  );
}

function DatabaseDetailDialog({ databaseId, onOpenChange }: { databaseId: string; onOpenChange: (open: boolean) => void }) {
  const { data: connection } = useDatabaseConnection(databaseId) as { data: any };
  const createBackup = useCreateBackup(databaseId);
  const rotatePassword = useRotatePassword(databaseId);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Connection Details</DialogTitle></DialogHeader>
        {connection && (
          <div className="flex flex-col gap-2 font-mono text-xs">
            {[
              ["Host", connection.privateHost],
              ["Port", connection.port],
              ["Database", connection.database],
              ["Username", connection.username],
              ["Password", connection.password],
              ["Connection URL", connection.connectionUrl],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between rounded-md border border-border p-2">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                  <p className="truncate">{value}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(String(value));
                    toast({ title: `${label} copied` });
                  }}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-start">
          <Button variant="outline" size="sm" onClick={() => createBackup.mutate()} loading={createBackup.isPending}>
            <Save className="h-3.5 w-3.5" /> Create Backup
          </Button>
          <Button variant="outline" size="sm" onClick={() => rotatePassword.mutate()} loading={rotatePassword.isPending}>
            <RotateCw className="h-3.5 w-3.5" /> Rotate Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
