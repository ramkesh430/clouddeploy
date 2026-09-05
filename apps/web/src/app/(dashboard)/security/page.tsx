"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSecurityOverview, useTwoFactorEnable, useTwoFactorSetup } from "@/hooks/use-phase3";

export default function SecurityPage() {
  const { data } = useSecurityOverview(); const setup = useTwoFactorSetup(); const enable = useTwoFactorEnable(); const [code, setCode] = useState("");
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">Security settings</h1><p className="text-sm text-muted-foreground">Protect account access, review sessions, and inspect suspicious sign-in events.</p></div><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Two-factor authentication</CardTitle><Badge variant={data?.twoFactorEnabled ? "success" : "warning"}>{data?.twoFactorEnabled ? "Enabled" : "Not enabled"}</Badge></div></CardHeader><CardContent className="space-y-4">{!data?.twoFactorEnabled && !setup.data && <Button onClick={() => setup.mutate()} loading={setup.isPending}>Start authenticator setup</Button>}{setup.data && <><p className="text-sm">Add this secret to your authenticator:</p><code className="block rounded-md bg-muted p-3 text-sm">{setup.data.secret}</code><div><Label>Six-digit code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div><Button disabled={code.length !== 6} loading={enable.isPending} onClick={() => enable.mutate(code)}>Verify and enable</Button>{enable.data && <div className="rounded-md border border-warning/40 bg-warning/10 p-3"><p className="text-sm font-medium">Save these recovery codes once</p><pre className="mt-2 text-xs">{enable.data.recoveryCodes.join("\n")}</pre></div>}</>}</CardContent></Card><Card><CardHeader><CardTitle>Recent sign-ins</CardTitle></CardHeader><CardContent className="space-y-3">{(data?.loginEvents ?? []).map((event) => <div key={event.id} className="flex items-center justify-between rounded-md border p-3 text-sm"><div><p>{event.ipAddress ?? "Unknown IP"}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p></div><Badge variant={event.suspicious ? "destructive" : event.successful ? "success" : "warning"}>{event.suspicious ? "Suspicious" : event.successful ? "Successful" : "Failed"}</Badge></div>)}</CardContent></Card></div></div>;
}
