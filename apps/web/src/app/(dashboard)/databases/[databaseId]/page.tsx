"use client";

import { useParams } from "next/navigation";
import { Copy, RotateCw, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDatabaseConnection, useRotatePassword } from "@/hooks/use-databases";
import { api } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/store/toast-store";

export default function DatabaseOverviewPage() {
  const params = useParams<{ databaseId: string }>();
  const { data: connection } = useDatabaseConnection(params.databaseId) as { data: any };
  const rotatePassword = useRotatePassword(params.databaseId);
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
          ) : (
            <p className="text-sm text-muted-foreground">Loading connection info...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
