"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useAdminResource } from "@/hooks/use-phase3";

interface UserRecord { id: string; email: string; fullName: string; isPlatformAdmin: boolean; isSuspended: boolean; suspendedReason: string | null; twoFactorEnabled: boolean; lastLoginAt: string | null }

export default function AdminUsersPage() {
  const client = useQueryClient();
  const { data = [] } = useAdminResource<UserRecord[]>("/admin/users");
  const mutate = useMutation({ mutationFn: ({ id, suspend, reason }: { id: string; suspend: boolean; reason?: string }) => api.post(`/admin/users/${id}/${suspend ? "suspend" : "resume"}`, suspend ? { reason } : undefined), onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "/admin/users"] }) });
  function toggle(user: UserRecord) { if (user.isSuspended) { if (window.confirm(`Restore access for ${user.email}?`)) mutate.mutate({ id: user.id, suspend: false }); return; } const reason = window.prompt("Suspension reason (recorded for audit):"); if (reason?.trim()) mutate.mutate({ id: user.id, suspend: true, reason: reason.trim() }); }
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Users</h1><p className="text-sm text-muted-foreground">Account access, security posture, and reviewed suspension controls.</p></div><Card><CardHeader><CardTitle>Platform accounts</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[840px] text-left text-sm"><thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr>{["User", "Admin", "2FA", "Last login", "Status", "Action"].map((label) => <th className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{data.map((user) => <tr key={user.id}><td className="px-4 py-3"><p className="font-medium">{user.fullName}</p><p className="text-xs text-muted-foreground">{user.email}</p></td><td className="px-4 py-3">{user.isPlatformAdmin ? "Yes" : "No"}</td><td className="px-4 py-3">{user.twoFactorEnabled ? "Enabled" : "Off"}</td><td className="px-4 py-3">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td><td className="px-4 py-3">{user.isSuspended ? `Suspended${user.suspendedReason ? `: ${user.suspendedReason}` : ""}` : "Active"}</td><td className="px-4 py-3"><Button size="sm" variant={user.isSuspended ? "outline" : "destructive"} disabled={mutate.isPending || user.isPlatformAdmin} onClick={() => toggle(user)}>{user.isSuspended ? "Resume" : "Suspend"}</Button></td></tr>)}</tbody></table></CardContent></Card></div>;
}
