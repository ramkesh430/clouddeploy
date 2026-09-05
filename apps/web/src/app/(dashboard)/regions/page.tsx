"use client";

import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRegions } from "@/hooks/use-phase3";

export default function RegionsPage() {
  const { data } = useRegions();
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Regions</h1><p className="text-sm text-muted-foreground">Choose where applications and stateful dependencies run. CloudDeploy warns before cross-region connections.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(data ?? []).map((region) => <Card key={region.id}><CardContent className="flex items-start justify-between p-5"><div className="flex gap-3"><div className="rounded-md bg-primary/10 p-2 text-primary"><MapPin className="h-4 w-4" /></div><div><p className="font-medium">{region.name}</p><p className="text-sm text-muted-foreground">{region.city}, {region.country}</p><p className="mt-2 font-mono text-xs text-muted-foreground">{region.code}</p></div></div><Badge variant="success">Active</Badge></CardContent></Card>)}</div></div>;
}
