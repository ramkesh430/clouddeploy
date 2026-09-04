"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Save } from "lucide-react";
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
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-4 font-medium">Backup</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Size</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Created</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(backups ?? []).map((b: any) => (
                <tr key={b.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4 font-mono text-xs">{b.id.slice(0, 12)}</td>
                  <td className="p-4 text-muted-foreground">{b.type}</td>
                  <td className="p-4 text-muted-foreground">{b.sizeBytes ? formatBytes(Number(b.sizeBytes)) : "—"}</td>
                  <td className="p-4"><StatusBadge status={b.status} /></td>
                  <td className="p-4 text-muted-foreground">{formatRelativeTime(b.createdAt)}</td>
                  <td className="p-4">
                    {b.status === "COMPLETED" && (
                      <Button size="sm" variant="outline" onClick={() => setConfirmBackupId(b.id)}>
                        Restore
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {(backups ?? []).length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No backups yet.</td></tr>
              )}
            </tbody>
          </table>
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
