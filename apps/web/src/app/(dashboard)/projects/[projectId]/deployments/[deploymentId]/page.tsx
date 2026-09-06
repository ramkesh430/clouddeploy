"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Loader2, Circle, Search, Download, Copy, Pause, Play, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { StatusBadge } from "@/components/ui/badge";
import { useDeployment, useRedeploy } from "@/hooks/use-deployments";
import { useDeploymentSocket } from "@/hooks/use-deployment-socket";
import { DEPLOYMENT_PIPELINE } from "@clouddeploy/deployment-core";
import { toast } from "@/lib/store/toast-store";

export default function DeploymentDetailPage() {
  const params = useParams<{ projectId: string; deploymentId: string }>();
  const { data: deployment } = useDeployment(params.deploymentId) as { data: any };
  const initialLogs = useMemo(
    () => (deployment?.logs ?? []).map((l: any) => ({ level: l.level, message: l.message, timestamp: l.timestamp })),
    [deployment?.logs],
  );
  const { logs, status } = useDeploymentSocket(params.deploymentId, initialLogs);
  const redeploy = useRedeploy();

  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentStatus = status?.status ?? deployment?.status ?? "QUEUED";
  const progressPct = status?.progressPct ?? deployment?.progressPct ?? 0;
  const currentStep = status?.currentStep ?? deployment?.currentStep;

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, paused]);

  useEffect(() => {
    if (currentStatus === "LIVE" && deployment?.status !== "LIVE") {
      toast({ title: "Deployment successful", description: "Your application is live.", variant: "success" });
    }
    if (currentStatus === "FAILED") {
      toast({ title: "Deployment failed", description: "Check the logs for details.", variant: "destructive" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus]);

  const filteredLogs = search ? logs.filter((l) => l.message.toLowerCase().includes(search.toLowerCase())) : logs;

  const isDone = currentStatus === "LIVE" || currentStatus === "FAILED" || currentStatus === "CANCELLED";

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.map((l) => `[${l.level}] ${l.message}`).join("\n"));
    toast({ title: "Logs copied" });
  };

  const downloadLogs = () => {
    const blob = new Blob([logs.map((l) => `${l.timestamp} [${l.level}] ${l.message}`).join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deployment-${params.deploymentId}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Deployment #{params.deploymentId.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">
            {deployment?.branch} · {deployment?.commitSha ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={currentStatus} />
          {isDone && (
            <Button size="sm" onClick={() => redeploy.mutate(params.deploymentId)} loading={redeploy.isPending}>
              Redeploy
            </Button>
          )}
          {currentStatus === "LIVE" && deployment?.environment !== "PREVIEW" && deployment?.project?.productionUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={`https://${deployment.project.productionUrl}`} target="_blank" rel="noreferrer">
                Open App <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {currentStatus === "LIVE" && deployment?.environment === "PREVIEW" && deployment?.previewUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={`https://${deployment.previewUrl}`} target="_blank" rel="noreferrer">
                Open Preview <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-col overflow-hidden bg-[#0b0f19] text-[#d1d5db]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search logs..."
                className="h-7 border-white/10 bg-white/5 pl-8 text-xs text-white placeholder:text-white/40"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={copyLogs}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={downloadLogs}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div ref={scrollRef} className="h-[520px] overflow-y-auto p-4 font-mono text-xs leading-relaxed scrollbar-thin">
            {filteredLogs.length === 0 && <p className="text-white/40">Waiting for logs...</p>}
            {filteredLogs.map((line, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 text-white/30">{new Date(line.timestamp).toLocaleTimeString()}</span>
                <span
                  className={
                    line.level === "ERROR" ? "text-red-400" : line.level === "WARN" ? "text-amber-400" : "text-white/80"
                  }
                >
                  {line.message}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-5 p-4">
            <div className="flex flex-col items-center gap-2 py-2">
              <CircularProgress
                value={progressPct}
                size={112}
                strokeWidth={9}
                colorClassName={currentStatus === "FAILED" ? "stroke-destructive" : currentStatus === "LIVE" ? "stroke-success" : "stroke-primary"}
              >
                <span className="text-2xl font-bold">{progressPct}%</span>
              </CircularProgress>
              <p className="text-sm font-medium">{currentStatus === "LIVE" ? "Deploy Live" : currentStatus === "FAILED" ? "Deployment Failed" : currentStep ?? "Deploying..."}</p>
              {!isDone && <p className="text-xs text-muted-foreground">This may take a few minutes.</p>}
            </div>
            <div className="flex flex-col gap-1">
              {DEPLOYMENT_PIPELINE.map((s) => {
                const done = progressPct >= s.progressAt;
                const active = !done && progressPct >= s.progressAt - 14;
                return (
                  <div key={s.key} className="flex items-center gap-2.5 py-1 text-sm">
                    {currentStatus === "FAILED" && !done ? (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    ) : done ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    )}
                    <span className={done ? "text-foreground" : active ? "font-medium text-foreground" : "text-muted-foreground"}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
