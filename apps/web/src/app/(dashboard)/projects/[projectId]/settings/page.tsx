"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProject, useProjectAction, useDeleteProject } from "@/hooks/use-projects";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { data: project } = useProject(params.projectId) as { data: any };
  const pause = useProjectAction("pause");
  const resume = useProjectAction("resume");
  const archive = useProjectAction("archive");
  const del = useDeleteProject();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic project information.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{project?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Slug</p>
            <p className="font-mono font-medium">{project?.slug}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Region</p>
            <p className="font-medium">{project?.region}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-medium">{project?.status}</p>
          </div>
        </CardContent>
      </Card>

      <ProjectMembersCard projectId={params.projectId} />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>These actions affect your project&apos;s availability.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Pause Project</p>
              <p className="text-xs text-muted-foreground">Stops all running services without deleting data.</p>
            </div>
            {project?.status === "PAUSED" ? (
              <Button size="sm" variant="outline" onClick={() => resume.mutate(params.projectId)} loading={resume.isPending}>
                Resume
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => pause.mutate(params.projectId)} loading={pause.isPending}>
                Pause
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Archive Project</p>
              <p className="text-xs text-muted-foreground">Hides the project from active views.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => archive.mutate(params.projectId)} loading={archive.isPending}>
              Archive
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div>
              <p className="text-sm font-medium">Delete Project</p>
              <p className="text-xs text-muted-foreground">Soft-deletes the project. Contact support to permanently purge data.</p>
            </div>
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="destructive">Delete</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete {project?.name}?</DialogTitle>
                  <DialogDescription>
                    This stops all services and removes the project from your workspace. This can be reversed by support within 30 days.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    loading={del.isPending}
                    onClick={() => del.mutate(params.projectId, { onSuccess: () => router.push("/projects") })}
                  >
                    Delete Project
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Grants explicit project-level access to Developer/Viewer org members, who
 * otherwise only see projects they created — Owner/Admin always see everything. */
function ProjectMembersCard({ projectId }: { projectId: string }) {
  const { active } = useActiveOrganization();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");

  const { data: projectMembers } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => api.get<any[]>(`/projects/${projectId}/members`),
  });

  const { data: orgMembers } = useQuery({
    queryKey: ["members", active?.id],
    queryFn: () => api.get<any[]>(`/organizations/${active?.id}/members`),
    enabled: !!active?.id,
  });

  const grantedUserIds = new Set((projectMembers ?? []).map((m) => m.userId));
  const grantable = (orgMembers ?? []).filter((m) => m.userId && !grantedUserIds.has(m.userId));

  const grant = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/members`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      toast({ title: "Access granted", variant: "success" });
      setOpen(false);
      setUserId("");
    },
  });

  const revoke = useMutation({
    mutationFn: (memberId: string) => api.delete(`/projects/${projectId}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      toast({ title: "Access revoked" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Project Members</CardTitle>
          <CardDescription>Developer/Viewer workspace members only see projects granted here (Owners/Admins see everything).</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={grantable.length === 0}>
              <Plus className="h-3.5 w-3.5" /> Grant Access
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Grant project access</DialogTitle></DialogHeader>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select a workspace member</option>
              {grantable.map((m) => (
                <option key={m.userId} value={m.userId}>{m.user?.fullName ?? m.email}</option>
              ))}
            </select>
            <DialogFooter>
              <Button loading={grant.isPending} disabled={!userId} onClick={() => grant.mutate()}>Grant Access</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {(projectMembers ?? []).map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-md border border-border p-2.5">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6"><AvatarFallback>{(m.user?.fullName ?? m.user?.email ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
              <p className="text-sm">{m.user?.fullName ?? m.user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => revoke.mutate(m.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {(projectMembers ?? []).length === 0 && (
          <p className="py-2 text-center text-sm text-muted-foreground">No individually-granted members — only Owners/Admins and the creator can see this project.</p>
        )}
      </CardContent>
    </Card>
  );
}
