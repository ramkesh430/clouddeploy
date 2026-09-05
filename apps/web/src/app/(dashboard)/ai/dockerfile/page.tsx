"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function DockerfilePage() {
  const { active } = useActiveOrganization(); const [manifest, setManifest] = useState('{"scripts":{"build":"npm run compile","start":"node dist/main.js"},"dependencies":{"express":"^4"}}');
  const generate = useMutation({ mutationFn: () => api.post<{ result: { dockerfile: string; explanation: string; warnings: string[] } }>("/ai/dockerfile", { organizationId: active!.id, repositoryFullName: "manual/input", files: [{ path: "package.json", content: manifest }] }) });
  const download = () => { if (!generate.data) return; const url = URL.createObjectURL(new Blob([generate.data.result.dockerfile], { type: "text/plain" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "Dockerfile"; anchor.click(); URL.revokeObjectURL(url); };
  return <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Generate from manifest</CardTitle></CardHeader><CardContent className="space-y-4"><Label>package.json</Label><textarea className="min-h-72 w-full rounded-md border p-3 font-mono text-xs" value={manifest} onChange={(e) => setManifest(e.target.value)} /><Button disabled={!active} loading={generate.isPending} onClick={() => generate.mutate()}>Generate Dockerfile</Button></CardContent></Card><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Review diff</CardTitle><Badge variant="secondary">Never pushed to Git</Badge></div></CardHeader><CardContent>{generate.data ? <div className="space-y-3"><pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-xs text-slate-100">{generate.data.result.dockerfile}</pre><div className="flex gap-2"><Button variant="outline" onClick={() => navigator.clipboard.writeText(generate.data!.result.dockerfile)}>Copy</Button><Button variant="outline" onClick={download}>Download</Button></div></div> : <p className="text-sm text-muted-foreground">Generated content appears here for explicit review.</p>}</CardContent></Card></div>;
}
