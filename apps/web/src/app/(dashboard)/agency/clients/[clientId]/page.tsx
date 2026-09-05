"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgencyClient } from "@/hooks/use-phase3";
import { formatCurrency } from "@/lib/utils";

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>(); const { data } = useAgencyClient(clientId);
  if (!data) return <p className="text-sm text-muted-foreground">Loading client…</p>;
  return <div className="space-y-5"><Card><CardContent className="flex items-start justify-between p-5"><div><h2 className="text-xl font-semibold">{data.company || data.name}</h2><p className="text-sm text-muted-foreground">{data.name} · {data.email}{data.phone ? ` · ${data.phone}` : ""}</p>{data.notes && <p className="mt-3 text-sm">{data.notes}</p>}</div><Badge variant="success">{data.status}</Badge></CardContent></Card><div className="grid gap-4 lg:grid-cols-2">{data.projects.map((item) => <Card key={item.id}><CardHeader><div className="flex items-center justify-between"><CardTitle>{item.project.name}</CardTitle><Badge variant="outline">{item.project.region}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="flex gap-4 text-sm"><span>Cost {formatCurrency(item.monthlyCostCents / 100)}</span><span>Revenue {formatCurrency(item.monthlyRevenueCents / 100)}</span></div><div className="flex flex-wrap gap-2">{item.project.services.map((service) => <Badge key={service.id} variant={service.status === "RUNNING" ? "success" : "muted"}>{service.name}: {service.status}</Badge>)}</div></CardContent></Card>)}</div></div>;
}
