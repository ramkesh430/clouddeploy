"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Save, Archive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useDatabaseBackups, useCreateBackup } from "@/hooks/use-databases";
import { api } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/store/toast-store";
import { formatBytes, formatRelativeTime } from "@/lib/utils";

export default function DatabaseBackupsPage() {
  const params = useParams<{ databaseId: string }>();
  const { data: backups } = useDatabaseBackups(params.databaseId);
  const createBackup = useCreateBackup(params.databaseId);
  const queryClient = useQueryClient();
  const [confirmBackupId, setConfirmBackupId] = useState<string | null>(null);

  const restore = useMutation({
    mutationFn: (backupId: string) => api.post(`/databases/${params.databaseId}/restore`, { backupId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["database-backups", params.databaseId] });
      queryClient.invalidateQueries({ queryKey: ["database", params.databaseId] });
      toast({ title: "Restoring from backup", variant: "success" });
      setConfirmBackupId(null);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => createBackup.mutate()} loading={createBackup.isPending}>
          <Save className="h-4 w-4" /> Create Backup
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col p-0">
          {(backups ?? []).map((b: any) => (
            <div key={b.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Archive className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-medium">{b.id.slice(0, 12)}</p>
                <p className="truncate text-xs text-muted-foreground">{b.type} · {b.sizeBytes ? formatBytes(Number(b.sizeBytes)) : "—"}</p>
              </div>
              <StatusBadge status={b.status} />
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{formatRelativeTime(b.createdAt)}</span>
              {b.status === "COMPLETED" && (
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => setConfirmBackupId(b.id)}>
                  Restore
                </Button>
              )}
            </div>
          ))}
          {(backups ?? []).length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No backups yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmBackupId} onOpenChange={(v) => !v && setConfirmBackupId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              This overwrites the current database contents with the selected backup. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBackupId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={restore.isPending}
              onClick={() => confirmBackupId && restore.mutate(confirmBackupId)}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
