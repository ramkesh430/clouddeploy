"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api-client";
import { useAdminResource } from "@/hooks/use-phase3";
import { useAuthStore } from "@/lib/store/auth-store";
import { ResourceCrudDialog, type FieldValue } from "@/components/admin/resource-crud-dialog";

interface UserRecord { id: string; email: string; fullName: string; isPlatformAdmin: boolean; isSuspended: boolean; suspendedReason: string | null; twoFactorEnabled: boolean; lastLoginAt: string | null }

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
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data = [] } = useAdminResource<UserRecord[]>("/admin/users");
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; user?: UserRecord } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const invalidate = () => client.invalidateQueries({ queryKey: ["admin", "/admin/users"] });

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

  function toggleSuspend(user: UserRecord) {
    if (user.isSuspended) { if (window.confirm(`Restore access for ${user.email}?`)) suspendMutation.mutate({ id: user.id, suspend: false }); return; }
    const reason = window.prompt("Suspension reason (recorded for audit):");
    if (reason?.trim()) suspendMutation.mutate({ id: user.id, suspend: true, reason: reason.trim() });
  }

  function askDelete(user: UserRecord) {
    if (window.confirm(`Delete ${user.email}? This deactivates the account and cannot be undone.`)) deleteMutation.mutate(user.id);
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
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>{["User", "Admin", "2FA", "Last login", "Status", "Actions"].map((label) => <th className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {data.map((user) => (
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
    </div>
  );
}
