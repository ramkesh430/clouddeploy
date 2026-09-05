"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useRepositoryAnalysis } from "@/hooks/use-phase3";

export default function AIAssistantPage() {
  const { active } = useActiveOrganization();
  const analyze = useRepositoryAnalysis();
  const [repository, setRepository] = useState("acme/example-app");
  const [manifest, setManifest] = useState('{\n  "scripts": { "build": "next build", "start": "next start" },\n  "dependencies": { "next": "^14", "react": "^18", "pg": "^8" }\n}');
  const [envReferences, setEnvReferences] = useState("process.env.DATABASE_URL\nprocess.env.NEXT_PUBLIC_API_URL");

  return <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
    <Card><CardHeader><CardTitle>Repository snapshot</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">
      <div className="space-y-1.5"><Label>Repository</Label><Input value={repository} onChange={(event) => setRepository(event.target.value)} /></div>
      <div className="space-y-1.5"><Label>package.json</Label><textarea className="min-h-56 w-full rounded-md border bg-background p-3 font-mono text-xs" value={manifest} onChange={(event) => setManifest(event.target.value)} /></div>
      <div className="space-y-1.5"><Label>Relevant source references</Label><textarea className="min-h-24 w-full rounded-md border bg-background p-3 font-mono text-xs" value={envReferences} onChange={(event) => setEnvReferences(event.target.value)} /></div>
      <p className="text-xs text-muted-foreground">Secret-shaped files and values are removed before analysis. Only file paths are retained as input metadata.</p>
      <Button loading={analyze.isPending} disabled={!active || !repository} onClick={() => active && analyze.mutate({ organizationId: active.id, repositoryFullName: repository, files: [{ path: "package.json", content: manifest }, { path: "src/config.ts", content: envReferences }] })}>Analyze repository</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Structured recommendation</CardTitle></CardHeader><CardContent>{analyze.data ? <pre className="max-h-[680px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(analyze.data.result, null, 2)}</pre> : <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">Run an analysis to see services, dependencies, environment suggestions, resources, architecture, and warnings.</div>}</CardContent></Card>
  </div>;
}
