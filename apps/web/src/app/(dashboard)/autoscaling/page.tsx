"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useProjects } from "@/hooks/use-projects";

interface ScalingState { policy: null | { enabled: boolean; minimumInstances: number; maximumInstances: number; cpuThresholdPct: number; memoryThresholdPct: number; requestThreshold: number | null; scaleUpCooldownSeconds: number; scaleDownCooldownSeconds: number }; currentInstances: number; events: Array<{ id: string; previousCount: number; desiredCount: number; reason: string; createdAt: string }> }

export default function AutoscalingPage() {
  const { active } = useActiveOrganization(); const { data: projects } = useProjects(active?.id ?? null); const services = useMemo(() => (projects ?? []).flatMap((project) => project.services.map((service) => ({ ...service, projectId: project.id, projectName: project.name }))), [projects]);
  const [serviceId, setServiceId] = useState(""); const selected = services.find((service) => service.id === serviceId); const queryClient = useQueryClient();
  useEffect(() => { if (!serviceId && services[0]) setServiceId(services[0].id); }, [serviceId, services]);
  const { data } = useQuery({ queryKey: ["autoscaling", serviceId], queryFn: () => api.get<ScalingState>(`/autoscaling/${serviceId}`), enabled: !!serviceId });
  const [form, setForm] = useState({ minimumInstances: 1, maximumInstances: 3, cpuThresholdPct: 75, memoryThresholdPct: 80, requestThreshold: 2500, scaleUpCooldownSeconds: 120, scaleDownCooldownSeconds: 300 });
  useEffect(() => { if (data?.policy) setForm({ ...form, ...Object.fromEntries(Object.entries(data.policy).filter(([key]) => key in form)) } as typeof form); }, [data?.policy]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({ mutationFn: () => api.put(`/autoscaling/${serviceId}`, { ...form, enabled: true, projectId: selected!.projectId, serviceId }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["autoscaling", serviceId] }) });
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Autoscaling</h1><p className="text-sm text-muted-foreground">Scale healthy service replicas from CPU, memory, or request pressure with separate cooldowns.</p></div><div className="grid gap-5 lg:grid-cols-[1fr_360px]"><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Horizontal policy</CardTitle><Badge variant={data?.policy?.enabled ? "success" : "muted"}>{data?.currentInstances ?? 0} running target</Badge></div></CardHeader><CardContent className="space-y-4"><div><Label>Service</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>{services.map((service) => <option key={service.id} value={service.id}>{service.projectName} / {service.name}</option>)}</select></div><div className="grid gap-4 sm:grid-cols-2">{Object.entries(form).map(([key, value]) => <div key={key}><Label>{key.replace(/([A-Z])/g, " $1")}</Label><Input type="number" value={value} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} /></div>)}</div><Button loading={save.isPending} disabled={!selected} onClick={() => save.mutate()}>Enable and save policy</Button></CardContent></Card><Card><CardHeader><CardTitle>Recent scaling events</CardTitle></CardHeader><CardContent className="space-y-3">{(data?.events ?? []).map((event) => <div key={event.id} className="rounded-md border p-3 text-sm"><div className="font-medium">{event.previousCount} → {event.desiredCount} instances</div><p className="text-xs text-muted-foreground">{event.reason}</p></div>)}{!data?.events.length && <p className="text-sm text-muted-foreground">No scaling events yet.</p>}</CardContent></Card></div></div>;
}
