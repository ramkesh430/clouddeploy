"use client";

import { useParams } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { useServices, useRestartService } from "@/hooks/use-services";

export default function ProjectServicesPage() {
  const params = useParams<{ projectId: string }>();
  const { data: services } = useServices(params.projectId) as { data: any[] | undefined };
  const restart = useRestartService();

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-4 font-medium">Service</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Runtime</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">CPU</th>
              <th className="p-4 font-medium">RAM</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(services ?? []).map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0">
                <td className="p-4 font-medium">{s.name}</td>
                <td className="p-4 text-muted-foreground">{s.type.replace(/_/g, " ")}</td>
                <td className="p-4 text-muted-foreground">{s.runtime}</td>
                <td className="p-4"><StatusBadge status={s.status} /></td>
                <td className="p-4 text-muted-foreground">{s.cpuCores}</td>
                <td className="p-4 text-muted-foreground">{s.ramMb} MB</td>
                <td className="p-4">
                  <Button variant="ghost" size="sm" onClick={() => restart.mutate(s.id)}>
                    <RotateCw className="h-3.5 w-3.5" /> Restart
                  </Button>
                </td>
              </tr>
            ))}
            {(services ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                  No services yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
