"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Copy, RotateCw, RefreshCw, TableProperties, Play, Archive, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/badge";
import { useDatabase, useDatabaseConnection, useRotatePassword, useDatabaseMetrics, useCreateBackup } from "@/hooks/use-databases";
import { api } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/store/toast-store";
import { formatBytes } from "@/lib/utils";

export default function DatabaseOverviewPage() {
  const params = useParams<{ databaseId: string }>();
  const { data: database } = useDatabase(params.databaseId);
  const { data: connection, isError: connectionError } = useDatabaseConnection(params.databaseId) as { data: any; isError: boolean };
  const { data: metrics } = useDatabaseMetrics(params.databaseId);
  const rotatePassword = useRotatePassword(params.databaseId);
  const createBackup = useCreateBackup(params.databaseId);
  const queryClient = useQueryClient();

  const restart = useMutation({
    mutationFn: () => api.post(`/databases/${params.databaseId}/restart`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["database", params.databaseId] });
      toast({ title: "Restarting database", variant: "success" });
    },
  });

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  };

  return (
    <div className="flex flex-col gap-4">
      {metrics?.supported && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Active Connections</p>
              <p className="mt-1 text-lg font-semibold">{metrics.connections}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Storage Used</p>
              <p className="mt-1 text-lg font-semibold">{formatBytes(metrics.sizeBytes ?? 0)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-muted-foreground">Storage Usage</p>
                <p className="text-xs font-medium">{metrics.storagePct}%</p>
              </div>
              <Progress value={Math.min(100, metrics.storagePct ?? 0)} className="mt-2" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Connection Details</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => restart.mutate()} loading={restart.isPending}>
                  <RefreshCw className="h-3.5 w-3.5" /> Restart
                </Button>
                <Button size="sm" variant="outline" onClick={() => rotatePassword.mutate()} loading={rotatePassword.isPending}>
                  <RotateCw className="h-3.5 w-3.5" /> Rotate Password
                </Button>
              </div>
            </div>
            {connection ? (
              <div className="flex flex-col gap-2 font-mono text-xs">
                {[
                  ["Host", connection.privateHost],
                  ["Port", connection.port],
                  ["Database", connection.database],
                  ["Username", connection.username],
                  ["Password", connection.password],
                  ["Connection URL", connection.connectionUrl],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex items-center justify-between rounded-md border border-border p-2.5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-sans uppercase text-muted-foreground">{label}</p>
                      <p className="truncate">{value}</p>
                    </div>
                    <button onClick={() => copy(label as string, String(value))} className="shrink-0 text-muted-foreground hover:text-foreground">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : connectionError ? (
              <p className="text-sm text-destructive">Could not load connection details for this database.</p>
            ) : (
              <p className="text-sm text-muted-foreground">Loading connection info...</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" size="sm" className="justify-start" asChild>
                <Link href={`/databases/${params.databaseId}/sql-editor`}>
                  <Play className="h-3.5 w-3.5" /> Open SQL Editor
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="justify-start" asChild>
                <Link href={`/databases/${params.databaseId}/tables`}>
                  <TableProperties className="h-3.5 w-3.5" /> Manage Tables
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={() => createBackup.mutate()} loading={createBackup.isPending}>
                <Archive className="h-3.5 w-3.5" /> Create Backup
              </Button>
              <Button variant="outline" size="sm" className="justify-start" asChild>
                <Link href={`/databases/${params.databaseId}/backups`}>
                  <History className="h-3.5 w-3.5" /> Restore Backup
                </Link>
              </Button>
            </CardContent>
          </Card>

          {database && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Database Information</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{database.engine}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium">{database.version}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-medium">{formatBytes((database.storageUsedMb ?? 0) * 1024 * 1024)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={database.status} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
