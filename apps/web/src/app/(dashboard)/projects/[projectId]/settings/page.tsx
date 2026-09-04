"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
