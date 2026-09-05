"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useBranding, useUpdateBranding } from "@/hooks/use-phase3";

export function BrandingForm({ whiteLabel = false }: { whiteLabel?: boolean }) {
  const { active } = useActiveOrganization(); const { data } = useBranding(active?.id); const update = useUpdateBranding();
  const [form, setForm] = useState({ brandName: "", logoUrl: "", customDomain: "", primaryAccent: "#2563eb", supportEmail: "", loginTitle: "", loginSubtitle: "" });
  useEffect(() => { if (data) setForm((current) => Object.fromEntries(Object.keys(current).map((key) => [key, String(data[key] ?? current[key as keyof typeof current])])) as typeof current); }, [data]);
  const fields = whiteLabel ? [["brandName", "Brand name"], ["logoUrl", "Logo URL"], ["customDomain", "Custom domain"], ["primaryAccent", "Primary accent"], ["supportEmail", "Support email"], ["loginTitle", "Login title"], ["loginSubtitle", "Login subtitle"]] as const : [["brandName", "Agency name"], ["supportEmail", "Support email"], ["primaryAccent", "Accent color"]] as const;
  return <Card className="max-w-2xl"><CardHeader><CardTitle>{whiteLabel ? "White label settings" : "Agency identity"}</CardTitle></CardHeader><CardContent className="space-y-4">{fields.map(([key, label]) => <div key={key} className="space-y-1.5"><Label>{label}</Label><Input type={key === "primaryAccent" ? "color" : "text"} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></div>)}<p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Client portal responses expose metrics, invoices, deployment and domain state only. Infrastructure credentials and environment secrets are never included.</p><Button disabled={!active || !form.brandName} loading={update.isPending} onClick={() => active && update.mutate({ organizationId: active.id, ...form, customLoginEnabled: whiteLabel })}>Save settings</Button></CardContent></Card>;
}
