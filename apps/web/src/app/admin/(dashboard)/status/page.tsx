"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useAdminResource } from "@/hooks/use-phase3";

interface PlatformService { id: string; name: string; status: string }
interface Incident { id: string; title: string; severity: string; status: string; description: string; startedAt: string; services: Array<{ service: PlatformService }> }

export default function AdminStatusPage() {
  const client = useQueryClient();
  const { data: services = [] } = useAdminResource<PlatformService[]>("/admin/status/services");
  const { data: incidents = [] } = useAdminResource<Incident[]>("/admin/status/incidents");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("MINOR");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const refresh = () => { client.invalidateQueries({ queryKey: ["admin", "/admin/status/services"] }); client.invalidateQueries({ queryKey: ["admin", "/admin/status/incidents"] }); };
  const create = useMutation({ mutationFn: () => api.post("/admin/status/incidents", { title, description, severity, serviceIds }), onSuccess: () => { setTitle(""); setDescription(""); setServiceIds([]); refresh(); } });
  const resolve = useMutation({ mutationFn: (id: string) => api.post(`/admin/status/incidents/${id}/updates`, { status: "RESOLVED", message: "Service has recovered and monitoring is stable." }), onSuccess: refresh });
  const updateService = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/status/services/${id}`, { status }), onSuccess: refresh });

  function submit(event: FormEvent) { event.preventDefault(); if (serviceIds.length) create.mutate(); }
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">Status management</h1><p className="text-sm text-muted-foreground">Publish service health and maintain a timestamped incident history.</p></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Platform services</CardTitle></CardHeader><CardContent className="space-y-3">{services.map((service) => <div className="flex items-center justify-between gap-3" key={service.id}><span className="text-sm font-medium">{service.name}</span><select className="h-9 rounded-md border bg-background px-2 text-sm" value={service.status} onChange={(event) => updateService.mutate({ id: service.id, status: event.target.value })}>{["OPERATIONAL", "DEGRADED", "PARTIAL_OUTAGE", "MAJOR_OUTAGE", "MAINTENANCE"].map((status) => <option key={status}>{status}</option>)}</select></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Create incident</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={submit}><Input required placeholder="Incident title" value={title} onChange={(event) => setTitle(event.target.value)} /><textarea required className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" placeholder="Customer-facing description" value={description} onChange={(event) => setDescription(event.target.value)} /><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={severity} onChange={(event) => setSeverity(event.target.value)}>{["MINOR", "MAJOR", "CRITICAL"].map((item) => <option key={item}>{item}</option>)}</select><div className="grid grid-cols-2 gap-2">{services.map((service) => <label className="flex items-center gap-2 text-sm" key={service.id}><input type="checkbox" checked={serviceIds.includes(service.id)} onChange={(event) => setServiceIds(event.target.checked ? [...serviceIds, service.id] : serviceIds.filter((id) => id !== service.id))} />{service.name}</label>)}</div><Button disabled={create.isPending || !serviceIds.length} type="submit">Publish incident</Button></form></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Incident history</CardTitle></CardHeader><CardContent className="space-y-3">{incidents.map((incident) => <div className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between" key={incident.id}><div><p className="font-medium">{incident.title}</p><p className="text-sm text-muted-foreground">{incident.severity} · {incident.status} · {incident.services.map((item) => item.service.name).join(", ")}</p></div>{incident.status !== "RESOLVED" && <Button variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate(incident.id)}>Resolve</Button>}</div>)}</CardContent></Card>
  </div>;
}
