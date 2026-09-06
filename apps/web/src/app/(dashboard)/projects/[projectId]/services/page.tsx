"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCw, Plus, Copy, Globe, Server, Database as DatabaseIcon, Layers, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useServices, useRestartService } from "@/hooks/use-services";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

const SERVICE_ICONS: Record<string, LucideIcon> = {
  WEB_SERVICE: Globe,
  STATIC_SITE: Globe,
  API_SERVICE: Server,
  DOCKER_SERVICE: Server,
  POSTGRES: DatabaseIcon,
  MYSQL: DatabaseIcon,
  MARIADB: DatabaseIcon,
  REDIS: Layers,
};

export default function ProjectServicesPage() {
  const params = useParams<{ projectId: string }>();
  const { data: services } = useServices(params.projectId) as { data: any[] | undefined };
  const restart = useRestartService();
  const queryClient = useQueryClient();

  const [redisOpen, setRedisOpen] = useState(false);
  const [redisName, setRedisName] = useState("cache");
  const [connectionFor, setConnectionFor] = useState<{ redisInstanceId: string } | null>(null);

  const createRedis = useMutation({
    mutationFn: () => api.post("/redis", { projectId: params.projectId, name: redisName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", params.projectId] });
      toast({ title: "Redis instance provisioning", variant: "success" });
      setRedisOpen(false);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={redisOpen} onOpenChange={setRedisOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> Add Redis</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Provision Redis</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={redisName} onChange={(e) => setRedisName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button loading={createRedis.isPending} onClick={() => createRedis.mutate()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="flex flex-col p-0">
          {(services ?? []).map((s) => {
            const Icon = SERVICE_ICONS[s.type] ?? Server;
            const isInternal = ["POSTGRES", "MYSQL", "MARIADB", "REDIS"].includes(s.type);
            return (
              <div key={s.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.type.replace(/_/g, " ")} · {s.runtime}</p>
                </div>
                <StatusBadge status={s.status} />
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{isInternal ? "Internal Network" : ""}</span>
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{s.cpuCores} CPU</span>
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{s.ramMb} MB</span>
                <div className="flex shrink-0 items-center gap-1">
                  {s.type === "REDIS" && s.redisInstance?.id && (
                    <Button variant="ghost" size="sm" onClick={() => setConnectionFor({ redisInstanceId: s.redisInstance.id })}>
                      Connection
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => restart.mutate(s.id)}>
                    <RotateCw className="h-3.5 w-3.5" /> Restart
                  </Button>
                </div>
              </div>
            );
          })}
          {(services ?? []).length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No services yet.</p>
          )}
        </CardContent>
      </Card>

      {connectionFor && (
        <RedisConnectionDialog redisInstanceId={connectionFor.redisInstanceId} onOpenChange={(v) => !v && setConnectionFor(null)} />
      )}
    </div>
  );
}

function RedisConnectionDialog({ redisInstanceId, onOpenChange }: { redisInstanceId: string; onOpenChange: (open: boolean) => void }) {
  const { data: info } = useQuery({
    queryKey: ["redis-connection", redisInstanceId],
    queryFn: () => api.get<any>(`/redis/${redisInstanceId}/connection`),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Redis Connection</DialogTitle></DialogHeader>
        {info ? (
          <div className="flex flex-col gap-2 font-mono text-xs">
            {[
              ["Host", info.host],
              ["Port", info.port],
              ["Username", info.username],
              ["Password", info.password],
              ["Key Prefix", info.keyPrefix],
              ["Connection URL", info.connectionUrl],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between rounded-md border border-border p-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-sans uppercase text-muted-foreground">{label}</p>
                  <p className="truncate">{value}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(String(value)); toast({ title: `${label} copied` }); }} className="shrink-0 text-muted-foreground hover:text-foreground">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <p className="text-muted-foreground">{info.note}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
