"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useAdminResource } from "@/hooks/use-phase3";

interface RegionRecord { id: string; code: string; name: string; continent: string; country: string | null; city: string | null; active: boolean }

export default function AdminRegionsPage() {
  const client = useQueryClient();
  const { data = [] } = useAdminResource<RegionRecord[]>("/admin/infrastructure/regions");
  const [form, setForm] = useState({ code: "", name: "", continent: "", country: "", city: "" });
  const refresh = () => client.invalidateQueries({ queryKey: ["admin", "/admin/infrastructure/regions"] });
  const create = useMutation({ mutationFn: () => api.post("/admin/infrastructure/regions", form), onSuccess: () => { setForm({ code: "", name: "", continent: "", country: "", city: "" }); refresh(); } });
  const toggle = useMutation({ mutationFn: (region: RegionRecord) => api.patch(`/admin/infrastructure/regions/${region.id}`, { active: !region.active }), onSuccess: refresh });
  function submit(event: FormEvent) { event.preventDefault(); create.mutate(); }
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Regions</h1><p className="text-sm text-muted-foreground">Commercial deployment locations and scheduling availability.</p></div><Card><CardHeader><CardTitle>Add region</CardTitle></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-3" onSubmit={submit}>{(["code", "name", "continent", "country", "city"] as const).map((key) => <Input key={key} required={!["country", "city"].includes(key)} placeholder={key[0].toUpperCase() + key.slice(1)} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />)}<Button loading={create.isPending}>Create region</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Deployment regions</CardTitle></CardHeader><CardContent className="space-y-3">{data.map((region) => <div className="flex items-center justify-between rounded-md border p-4" key={region.id}><div><p className="font-medium">{region.name} <span className="text-xs text-muted-foreground">{region.code}</span></p><p className="text-sm text-muted-foreground">{[region.city, region.country, region.continent].filter(Boolean).join(", ")}</p></div><Button size="sm" variant={region.active ? "outline" : "default"} onClick={() => toggle.mutate(region)}>{region.active ? "Disable" : "Enable"}</Button></div>)}</CardContent></Card></div>;
}
