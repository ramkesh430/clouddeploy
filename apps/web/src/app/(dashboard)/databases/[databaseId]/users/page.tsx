"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useDatabaseUsers, useCreateDatabaseUser, useDeleteDatabaseUser } from "@/hooks/use-databases";
import { toast } from "@/lib/store/toast-store";
import { formatRelativeTime } from "@/lib/utils";

export default function DatabaseUsersPage() {
  const params = useParams<{ databaseId: string }>();
  const { data: users } = useDatabaseUsers(params.databaseId);
  const createUser = useCreateDatabaseUser(params.databaseId);
  const deleteUser = useDeleteDatabaseUser(params.databaseId);

  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"readonly" | "readwrite">("readonly");
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: "Copied" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Additional Postgres roles scoped to this database, e.g. a read-only credential for an analytics tool.
        </p>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setUsername(""); setRole("readonly"); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a database user</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Username</Label>
                <Input placeholder="analytics" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, underscores only.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Access</Label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "readonly" | "readwrite")}
                >
                  <option value="readonly">Read-only</option>
                  <option value="readwrite">Read-write</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                loading={createUser.isPending}
                disabled={!username}
                onClick={() =>
                  createUser.mutate(
                    { username, role },
                    {
                      onSuccess: (data) => {
                        setCreated({ username: data.username, password: data.password });
                        setOpen(false);
                        setUsername("");
                      },
                    },
                  )
                }
              >
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-4 font-medium">Username</th>
                <th className="p-4 font-medium">Access</th>
                <th className="p-4 font-medium">Created</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4 font-mono text-xs">{u.username}</td>
                  <td className="p-4"><Badge variant={u.role === "readwrite" ? "warning" : "outline"}>{u.role}</Badge></td>
                  <td className="p-4 text-muted-foreground">{formatRelativeTime(u.createdAt)}</td>
                  <td className="p-4">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteId(u.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {(users ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">No additional database users yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!created} onOpenChange={(v) => !v && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User created</DialogTitle>
            <DialogDescription>This password is shown once and cannot be retrieved again.</DialogDescription>
          </DialogHeader>
          {created && (
            <div className="flex flex-col gap-2 font-mono text-xs">
              {[["Username", created.username], ["Password", created.password]].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-sans uppercase text-muted-foreground">{label}</p>
                    <p className="truncate">{value}</p>
                  </div>
                  <button onClick={() => copy(value)} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this database user?</DialogTitle>
            <DialogDescription>This drops the underlying Postgres role. Anything still connected as this user will be disconnected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={deleteUser.isPending}
              onClick={() => confirmDeleteId && deleteUser.mutate(confirmDeleteId, { onSuccess: () => setConfirmDeleteId(null) })}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
