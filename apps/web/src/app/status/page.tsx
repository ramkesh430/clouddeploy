"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type ServiceStatus = "OPERATIONAL" | "DEGRADED" | "PARTIAL_OUTAGE" | "MAJOR_OUTAGE" | "MAINTENANCE";
interface PlatformService { id: string; name: string; status: ServiceStatus; description?: string | null }
interface IncidentUpdate { id: string; status: string; message: string; createdAt: string }
interface Incident { id: string; title: string; severity: string; status: string; description: string; startedAt: string; resolvedAt: string | null; services: Array<{ service: PlatformService }>; updates: IncidentUpdate[] }
interface StatusPayload { overall: ServiceStatus; services: PlatformService[]; incidents: Incident[]; generatedAt: string }

const labels: Record<ServiceStatus, string> = { OPERATIONAL: "Operational", DEGRADED: "Degraded", PARTIAL_OUTAGE: "Partial outage", MAJOR_OUTAGE: "Major outage", MAINTENANCE: "Maintenance" };
const colors: Record<ServiceStatus, string> = { OPERATIONAL: "bg-emerald-500 text-emerald-700", DEGRADED: "bg-amber-500 text-amber-700", PARTIAL_OUTAGE: "bg-orange-500 text-orange-700", MAJOR_OUTAGE: "bg-red-500 text-red-700", MAINTENANCE: "bg-blue-500 text-blue-700" };

export default function StatusPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["public-status"], queryFn: () => api.get<StatusPayload>("/status", { skipAuth: true }), refetchInterval: 30_000 });
  const overall = data?.overall ?? "OPERATIONAL";
  const active = data?.incidents.filter((incident) => incident.status !== "RESOLVED") ?? [];
  const recent = data?.incidents.filter((incident) => incident.status === "RESOLVED") ?? [];

  return <div className="min-h-screen bg-muted/20">
    <header className="border-b bg-background"><div className="container flex h-16 items-center justify-between"><Link href="/" className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Boxes className="h-4 w-4" /></div><span className="text-base font-semibold">CloudDeploy Status</span></Link><span className="text-xs text-muted-foreground">Updated every 30 seconds</span></div></header>
    <main className="container mx-auto max-w-4xl space-y-8 py-12">
      <section className="rounded-lg border bg-background p-6 shadow-sm"><div className="flex items-center gap-3"><span className={cn("h-3 w-3 rounded-full", colors[overall].split(" ")[0])} /><div><h1 className="text-xl font-semibold">{overall === "OPERATIONAL" ? "All systems operational" : labels[overall]}</h1><p className="text-sm text-muted-foreground">Live health for CloudDeploy control-plane and managed services.</p></div></div></section>
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">Status data is temporarily unavailable. The status service will retry automatically.</p>}
      <section><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Services</h2><div className="space-y-2">{isLoading ? <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading service health…</CardContent></Card> : data?.services.map((service) => <Card key={service.id}><CardContent className="flex items-center justify-between p-4 text-sm"><div><span className="font-medium">{service.name}</span>{service.description && <p className="text-xs text-muted-foreground">{service.description}</p>}</div><span className={cn("flex items-center gap-2", colors[service.status].split(" ")[1])}><span className={cn("h-2 w-2 rounded-full", colors[service.status].split(" ")[0])} />{labels[service.status]}</span></CardContent></Card>)}</div></section>
      {active.length > 0 && <IncidentList title="Active incidents" incidents={active} />}
      <IncidentList title="Recent incidents" incidents={recent} empty="No incidents reported in the last 14 days." />
      {data?.generatedAt && <p className="text-center text-xs text-muted-foreground">Last generated {new Date(data.generatedAt).toLocaleString()}</p>}
    </main>
  </div>;
}

function IncidentList({ title, incidents, empty }: { title: string; incidents: Incident[]; empty?: string }) {
  return <section><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>{incidents.length === 0 ? <Card><CardContent className="p-5 text-sm text-muted-foreground">{empty ?? "No active incidents."}</CardContent></Card> : <div className="space-y-3">{incidents.map((incident) => <Card key={incident.id}><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{incident.title}</h3><p className="text-sm text-muted-foreground">{incident.services.map((item) => item.service.name).join(", ")}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{incident.status.replaceAll("_", " ")}</span></div><p className="text-sm">{incident.description}</p>{incident.updates[0] && <div className="border-l-2 pl-3"><p className="text-sm">{incident.updates[0].message}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(incident.updates[0].createdAt).toLocaleString()}</p></div>}</CardContent></Card>)}</div>}</section>;
}
