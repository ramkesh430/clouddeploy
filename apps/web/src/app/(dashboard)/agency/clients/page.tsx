"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAgencyClients, useCreateAgencyClient } from "@/hooks/use-phase3";

export default function ClientsPage() {
  const { active } = useActiveOrganization(); const { data } = useAgencyClients(active?.id); const create = useCreateAgencyClient(); const [name, setName] = useState(""); const [company, setCompany] = useState(""); const [email, setEmail] = useState("");
  return <div className="grid gap-5 xl:grid-cols-[1fr_340px]"><Card><CardHeader><CardTitle>Clients</CardTitle></CardHeader><CardContent className="divide-y p-0">{(data?.data ?? []).map((client) => <Link href={`/agency/clients/${client.id}`} key={client.id} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40"><div><p className="font-medium">{client.company || client.name}</p><p className="text-sm text-muted-foreground">{client.name} · {client.email}</p></div><div className="flex items-center gap-3"><Badge variant="outline">{client._count?.projects ?? 0} projects</Badge><Badge variant={client.status === "ACTIVE" ? "success" : "muted"}>{client.status}</Badge></div></Link>)}{!data?.data.length && <p className="p-8 text-center text-sm text-muted-foreground">No agency clients yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Add client</CardTitle></CardHeader><CardContent className="space-y-3"><div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div><div><Label>Company</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} /></div><div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div><Button className="w-full" loading={create.isPending} disabled={!active || !name || !email} onClick={() => active && create.mutate({ organizationId: active.id, name, company: company || undefined, email }, { onSuccess: () => { setName(""); setCompany(""); setEmail(""); } })}>Add client</Button></CardContent></Card></div>;
}
