"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, LogIn, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/lib/store/auth-store";
import { ResourceCrudDialog, type FieldValue } from "@/components/admin/resource-crud-dialog";

interface UserRecord { id: string; email: string; fullName: string; isPlatformAdmin: boolean; isSuspended: boolean; suspendedReason: string | null; twoFactorEnabled: boolean; lastLoginAt: string | null }
interface UsersPage { data: UserRecord[]; nextCursor: string | null }
interface SessionRecord { id: string; ipAddress: string | null; userAgent: string | null; createdAt: string; expiresAt: string }

const createFields = [
  { key: "fullName", label: "Full name", type: "text" as const, required: true },
  { key: "email", label: "Email", type: "text" as const, required: true },
  { key: "password", label: "Password (8+ characters)", type: "text" as const, required: true },
  { key: "isPlatformAdmin", label: "Grant platform administrator access", type: "checkbox" as const },
];
const editFields = [
  { key: "fullName", label: "Full name", type: "text" as const, required: true },
  { key: "email", label: "Email", type: "text" as const, required: true },
  { key: "isPlatformAdmin", label: "Platform administrator", type: "checkbox" as const },
];

export default function AdminUsersPage() {
  const client = useQueryClient();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; user?: UserRecord } | null>(null);
  const [sessionsUser, setSessionsUser] = useState<UserRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["admin", "/admin/users", "paginated"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.get<UsersPage>(`/admin/users?limit=25${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const rows = data?.pages.flatMap((page) => page.data) ?? [];
  const invalidate = () => client.invalidateQueries({ queryKey: ["admin", "/admin/users", "paginated"] });

  const suspendMutation = useMutation({ mutationFn: ({ id, suspend, reason }: { id: string; suspend: boolean; reason?: string }) => api.post(`/admin/users/${id}/${suspend ? "suspend" : "resume"}`, suspend ? { reason } : undefined), onSuccess: invalidate });
  const createMutation = useMutation({
    mutationFn: (values: Record<string, FieldValue>) => api.post("/admin/users", values),
    onSuccess: () => { invalidate(); setDialog(null); setFormError(null); },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Something went wrong"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, FieldValue> }) => api.patch(`/admin/users/${id}`, values),
    onSuccess: () => { invalidate(); setDialog(null); setFormError(null); },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Something went wrong"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Delete failed"),
  });
  const impersonateMutation = useMutation({
    mutationFn: (id: string) => api.post<{ user: AuthUser; accessToken: string }>(`/admin/users/${id}/impersonate`),
    onSuccess: (result) => { startImpersonation(result.user, result.accessToken); router.push("/dashboard"); },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Impersonation failed"),
  });

  function toggleSuspend(user: UserRecord) {
    if (user.isSuspended) { if (window.confirm(`Restore access for ${user.email}?`)) suspendMutation.mutate({ id: user.id, suspend: false }); return; }
    const reason = window.prompt("Suspension reason (recorded for audit):");
    if (reason?.trim()) suspendMutation.mutate({ id: user.id, suspend: true, reason: reason.trim() });
  }

  function askDelete(user: UserRecord) {
    if (window.confirm(`Delete ${user.email}? This deactivates the account and cannot be undone.`)) deleteMutation.mutate(user.id);
  }

  function askImpersonate(user: UserRecord) {
    if (window.confirm(`View the app as ${user.email}? You can return to your admin session at any time.`)) impersonateMutation.mutate(user.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Account access, security posture, and reviewed suspension controls.</p>
        </div>
        <Button onClick={() => { setFormError(null); setDialog({ mode: "create" }); }}>
          <Plus className="h-4 w-4" /> New user
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Platform accounts</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1060px] text-left text-sm">
            <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>{["User", "Admin", "2FA", "Last login", "Status", "Actions"].map((label) => <th className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3"><p className="font-medium">{user.fullName}</p><p className="text-xs text-muted-foreground">{user.email}</p></td>
                  <td className="px-4 py-3">{user.isPlatformAdmin ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{user.twoFactorEnabled ? "Enabled" : "Off"}</td>
                  <td className="px-4 py-3">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3">{user.isSuspended ? `Suspended${user.suspendedReason ? `: ${user.suspendedReason}` : ""}` : "Active"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant={user.isSuspended ? "outline" : "destructive"} disabled={suspendMutation.isPending || user.isPlatformAdmin} onClick={() => toggleSuspend(user)}>
                        {user.isSuspended ? "Resume" : "Suspend"}
                      </Button>
                      <Button size="sm" variant="outline" title="Active sessions" onClick={() => setSessionsUser(user)}>
                        <Monitor className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" title="View as this user" disabled={impersonateMutation.isPending || user.isPlatformAdmin || user.id === currentUserId} onClick={() => askImpersonate(user)}>
                        <LogIn className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setFormError(null); setDialog({ mode: "edit", user }); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" disabled={deleteMutation.isPending || user.id === currentUserId} onClick={() => askDelete(user)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasNextPage && (
            <div className="flex justify-center border-t p-4">
              <Button variant="outline" size="sm" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ResourceCrudDialog
        open={dialog?.mode === "create"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="New user"
        fields={createFields}
        submitLabel="Create"
        pending={createMutation.isPending}
        error={formError}
        onSubmit={(values) => createMutation.mutate(values)}
      />
      {dialog?.mode === "edit" && dialog.user && (
        <ResourceCrudDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="Edit user"
          fields={editFields}
          initialValues={{ fullName: dialog.user.fullName, email: dialog.user.email, isPlatformAdmin: dialog.user.isPlatformAdmin }}
          submitLabel="Save changes"
          pending={updateMutation.isPending}
          error={formError}
          onSubmit={(values) => updateMutation.mutate({ id: dialog.user!.id, values })}
        />
      )}
      {sessionsUser && <SessionsDialog user={sessionsUser} onClose={() => setSessionsUser(null)} />}
    </div>
  );
}

function SessionsDialog({ user, onClose }: { user: UserRecord; onClose: () => void }) {
  const client = useQueryClient();
  const { data: sessions = [], isLoading } = useQuery({ queryKey: ["admin", "user-sessions", user.id], queryFn: () => api.get<SessionRecord[]>(`/admin/users/${user.id}/sessions`) });
  const revoke = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/admin/users/${user.id}/sessions/${sessionId}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "user-sessions", user.id] }),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Active sessions — {user.email}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{session.ipAddress ?? "Unknown IP"}</p>
                  <p className="text-xs text-muted-foreground">{session.userAgent ?? "Unknown device"}</p>
                  <p className="text-xs text-muted-foreground">Signed in {new Date(session.createdAt).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="destructive" disabled={revoke.isPending} onClick={() => revoke.mutate(session.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
