"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Play, Pause, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useCronJobs, useCreateCronJob, useCronJobAction, useDeleteCronJob, useCronJobDetail } from "@/hooks/use-cron-jobs";
import { formatRelativeTime } from "@/lib/utils";

export default function CronJobsPage() {
  const params = useParams<{ projectId: string }>();
  const { data: cronJobs, isLoading } = useCronJobs(params.projectId);
  const createCronJob = useCreateCronJob();
  const pause = useCronJobAction("pause");
  const resume = useCronJobAction("resume");
  const trigger = useCronJobAction("trigger");
  const deleteCronJob = useDeleteCronJob();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [cronExpression, setCronExpression] = useState("0 2 * * *");
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Create Cron Job</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a cron job</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input placeholder="Daily Backup" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Command</Label>
                <Input placeholder="npm run backup" value={command} onChange={(e) => setCommand(e.target.value)} className="font-mono" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Cron Expression</Label>
                <Input placeholder="0 2 * * *" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} className="font-mono" />
                <p className="text-xs text-muted-foreground">UTC. Example: <code>0 2 * * *</code> runs daily at 2am.</p>
              </div>
            </div>
            <DialogFooter>
              <Button
                loading={createCronJob.isPending}
                disabled={!name || !command || !cronExpression}
                onClick={() =>
                  createCronJob.mutate(
                    { projectId: params.projectId, name, command, cronExpression },
                    { onSuccess: () => { setOpen(false); setName(""); setCommand(""); } },
                  )
                }
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!isLoading && (cronJobs ?? []).length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState title="No Cron Jobs" description="Schedule recurring tasks for this project." action={{ label: "Create Cron Job", href: "#", icon: Plus }} /></CardContent></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {(cronJobs ?? []).map((job) => (
            <Card key={job.id}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4">
                  <button className="flex flex-1 items-center gap-3 text-left" onClick={() => setExpanded(expanded === job.id ? null : job.id)}>
                    {expanded === job.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">{job.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{job.cronExpression} · {job.command}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    <Badge variant={job.status === "ACTIVE" ? "success" : "muted"}>{job.status}</Badge>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Last: {job.lastRunAt ? formatRelativeTime(job.lastRunAt) : "never"}</p>
                      <p>Next: {job.nextRunAt ? formatRelativeTime(job.nextRunAt) : "—"}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => trigger.mutate(job.id)}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    {job.status === "PAUSED" ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resume.mutate(job.id)}>
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => pause.mutate(job.id)}>
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCronJob.mutate(job.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {expanded === job.id && <CronExecutionHistory cronJobId={job.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CronExecutionHistory({ cronJobId }: { cronJobId: string }) {
  const { data: job } = useCronJobDetail(cronJobId) as { data: any };
  const executions = job?.executions ?? [];

  return (
    <div className="border-t border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Started</th>
            <th className="px-4 py-2 font-medium">Duration</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Output</th>
          </tr>
        </thead>
        <tbody>
          {executions.map((e: any) => (
            <tr key={e.id} className="border-t border-border/60">
              <td className="px-4 py-2 text-muted-foreground">{formatRelativeTime(e.startedAt)}</td>
              <td className="px-4 py-2 text-muted-foreground">{e.durationMs ? `${(e.durationMs / 1000).toFixed(1)}s` : "—"}</td>
              <td className="px-4 py-2"><Badge variant={e.status === "SUCCEEDED" ? "success" : e.status === "FAILED" ? "destructive" : "warning"}>{e.status}</Badge></td>
              <td className="px-4 py-2 font-mono text-muted-foreground">{e.logOutput?.split("\n")[0] ?? "—"}</td>
            </tr>
          ))}
          {executions.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">No runs yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
