"use client";

import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDatabaseConnections } from "@/hooks/use-databases";
import { formatRelativeTime } from "@/lib/utils";

export default function DatabaseConnectionsPage() {
  const params = useParams<{ databaseId: string }>();
  const { data } = useDatabaseConnections(params.databaseId);

  if (data && !data.supported) {
    return <p className="text-sm text-muted-foreground">{data.reason}</p>;
  }

  const connections = data?.connections ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Live sessions from <code className="rounded bg-muted px-1 py-0.5 text-xs">pg_stat_activity</code>, refreshed every few seconds.
      </p>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-4 font-medium">PID</th>
                <th className="p-4 font-medium">User</th>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">State</th>
                <th className="p-4 font-medium">Query</th>
                <th className="p-4 font-medium">Connected</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.pid} className="border-b border-border/60 last:border-0">
                  <td className="p-4 font-mono text-xs text-muted-foreground">{c.pid}</td>
                  <td className="p-4 font-mono text-xs">{c.username}</td>
                  <td className="p-4 text-muted-foreground">{c.clientAddr ?? "—"}</td>
                  <td className="p-4"><Badge variant={c.state === "active" ? "success" : "muted"}>{c.state}</Badge></td>
                  <td className="max-w-xs truncate p-4 font-mono text-xs text-muted-foreground" title={c.query}>{c.query || "—"}</td>
                  <td className="p-4 text-muted-foreground">{formatRelativeTime(c.connectedAt)}</td>
                </tr>
              ))}
              {connections.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No other active connections right now.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
