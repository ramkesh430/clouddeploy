"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";
import { formatRelativeTime } from "@/lib/utils";

const ROLES = ["OWNER", "ADMIN", "DEVELOPER", "BILLING_MANAGER", "VIEWER"];

export default function TeamPage() {
  const { active } = useActiveOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("DEVELOPER");

  const { data: members } = useQuery({
    queryKey: ["members", active?.id],
    queryFn: () => api.get<any[]>(`/organizations/${active?.id}/members`),
    enabled: !!active?.id,
  });

  const invite = useMutation({
    mutationFn: () => api.post(`/organizations/${active?.id}/members`, { email, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", active?.id] });
      toast({ title: "Invitation sent", variant: "success" });
      setOpen(false);
      setEmail("");
    },
  });

  const remove = useMutation({
    mutationFn: (memberId: string) => api.delete(`/organizations/${active?.id}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", active?.id] });
      toast({ title: "Member removed" });
    },
  });

  const changeRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      api.patch(`/organizations/${active?.id}/members/${memberId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", active?.id] });
      toast({ title: "Role updated", variant: "success" });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">Members of {active?.name ?? "this workspace"}.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Invite Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite a team member</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="teammate@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Role</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button loading={invite.isPending} disabled={!email} onClick={() => invite.mutate()}>Send Invitation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-4 font-medium">Member</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Joined</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7"><AvatarFallback>{m.email.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                      <div>
                        <p className="font-medium">{m.user?.fullName ?? m.email}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {m.role === "OWNER" ? (
                      <Badge variant="outline">Owner</Badge>
                    ) : (
                      <select
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                        value={m.role}
                        disabled={changeRole.isPending}
                        onChange={(e) => changeRole.mutate({ memberId: m.id, role: e.target.value })}
                      >
                        {ROLES.filter((r) => r !== "OWNER").map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="p-4"><StatusBadge status={m.status} /></td>
                  <td className="p-4 text-muted-foreground">{m.joinedAt ? formatRelativeTime(m.joinedAt) : "Pending"}</td>
                  <td className="p-4">
                    {m.role !== "OWNER" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
