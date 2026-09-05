"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useResourceRecommendation } from "@/hooks/use-phase3";

export default function AIRecommendationsPage() {
  const { active } = useActiveOrganization(); const recommend = useResourceRecommendation(); const [projectId, setProjectId] = useState(""); const [traffic, setTraffic] = useState("1000");
  return <Card className="max-w-3xl"><CardHeader><CardTitle>Deployment resource recommendation</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Project ID</Label><Input value={projectId} onChange={(e) => setProjectId(e.target.value)} /></div><div className="space-y-1.5"><Label>Expected requests / minute</Label><Input type="number" value={traffic} onChange={(e) => setTraffic(e.target.value)} /></div></div><Button loading={recommend.isPending} disabled={!active || !projectId} onClick={() => active && recommend.mutate({ organizationId: active.id, projectId, trafficRequestsPerMinute: Number(traffic) })}>Recommend capacity</Button>{recommend.data && <pre className="overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(recommend.data.result, null, 2)}</pre>}</CardContent></Card>;
}
