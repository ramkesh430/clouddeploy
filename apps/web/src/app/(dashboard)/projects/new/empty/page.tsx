"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, ArrowLeft, ArrowRight, Rocket, Server, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useCreateProject } from "@/hooks/use-projects";
import { useCreateService } from "@/hooks/use-services";
import { useCreateDeployment } from "@/hooks/use-deployments";
import { RESOURCE_PRESETS, ServiceType, Runtime } from "@clouddeploy/types";
import { formatCurrency } from "@/lib/utils";

const STEPS = ["Project", "Services", "Review", "Deploy"] as const;

interface DraftService {
  id: string;
  name: string;
  type: ServiceType;
  runtime: Runtime;
  rootDirectory: string;
  buildCommand: string;
  startCommand: string;
  port: string;
  resourcePreset: "nano" | "starter" | "developer" | "pro";
}

function newDraftService(overrides: Partial<DraftService> = {}): DraftService {
  return {
    id: Math.random().toString(36).slice(2),
    name: overrides.name ?? "web",
    type: overrides.type ?? ServiceType.WEB_SERVICE,
    runtime: overrides.runtime ?? Runtime.NODE,
    rootDirectory: ".",
    buildCommand: "npm run build",
    startCommand: "npm start",
    port: "3000",
    resourcePreset: "starter",
    ...overrides,
  };
}

export default function EmptyProjectWizardPage() {
  return (
    <Suspense fallback={null}>
      <EmptyProjectWizard />
    </Suspense>
  );
}

function EmptyProjectWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dockerMode = searchParams.get("mode") === "docker";
  const { active } = useActiveOrganization();
  const createProject = useCreateProject();
  const createService = useCreateService();
  const createDeployment = useCreateDeployment();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [region, setRegion] = useState("us-east");
  const [services, setServices] = useState<DraftService[]>([
    newDraftService(dockerMode ? { name: "app", type: ServiceType.DOCKER_SERVICE, runtime: Runtime.DOCKER, port: "8080" } : {}),
  ]);
  const [isDeploying, setIsDeploying] = useState(false);

  const updateService = (id: string, patch: Partial<DraftService>) =>
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeService = (id: string) => setServices((prev) => prev.filter((s) => s.id !== id));

  const estimatedCost = useMemo(
    () =>
      services.reduce((sum, s) => {
        const preset = RESOURCE_PRESETS.find((p) => p.id === s.resourcePreset);
        return sum + (preset?.estimatedMonthlyUsd ?? 0);
      }, 0),
    [services],
  );

  const canContinueFromProject = name.trim().length >= 2 && slug.trim().length >= 2;
  const canContinueFromServices = services.length > 0 && services.every((s) => s.name.trim().length > 0);

  const handleDeploy = async () => {
    if (!active) return;
    setIsDeploying(true);
    try {
      const project = await createProject.mutateAsync({ organizationId: active.id, name, slug, region });
      for (const s of services) {
        await createService.mutateAsync({
          projectId: project.id,
          name: s.name,
          type: s.type,
          runtime: s.runtime,
          rootDirectory: s.rootDirectory || ".",
          buildCommand: s.buildCommand || undefined,
          startCommand: s.startCommand || undefined,
          port: s.port ? Number(s.port) : undefined,
          resourcePreset: s.resourcePreset,
        });
      }
      createDeployment.mutate({ projectId: project.id });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                i <= step ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {i + 1}
            </span>
            <span className={i === step ? "font-medium text-foreground" : ""}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project details</CardTitle>
            <CardDescription>Name your project and choose a region.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                }}
                placeholder="ShopFront"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} placeholder="shopfront" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="region">Region</Label>
              <select
                id="region"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="us-east">US East (Virginia)</option>
                <option value="us-west">US West (Oregon)</option>
                <option value="eu-west">EU West (Ireland)</option>
                <option value="ap-south">Asia Pacific (Mumbai)</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>Add one service per process — frontend, backend, worker, etc.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {services.map((s) => (
              <div key={s.id} className="flex flex-col gap-3 rounded-md border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Server className="h-4 w-4 text-primary" /> Service
                  </div>
                  {services.length > 1 && (
                    <button onClick={() => removeService(s.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Name</Label>
                    <Input value={s.name} onChange={(e) => updateService(s.id, { name: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Type</Label>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={s.type}
                      onChange={(e) => updateService(s.id, { type: e.target.value as ServiceType })}
                    >
                      {Object.values(ServiceType)
                        .filter((t) => !["POSTGRES", "MYSQL", "MARIADB", "REDIS", "OBJECT_STORAGE"].includes(t))
                        .map((t) => (
                          <option key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Root Directory</Label>
                    <Input value={s.rootDirectory} onChange={(e) => updateService(s.id, { rootDirectory: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Port</Label>
                    <Input value={s.port} onChange={(e) => updateService(s.id, { port: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Build Command</Label>
                    <Input value={s.buildCommand} onChange={(e) => updateService(s.id, { buildCommand: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Start Command</Label>
                    <Input value={s.startCommand} onChange={(e) => updateService(s.id, { startCommand: e.target.value })} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Resources</Label>
                  <div className="flex gap-2">
                    {RESOURCE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => updateService(s.id, { resourcePreset: preset.id as DraftService["resourcePreset"] })}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                          s.resourcePreset === preset.id ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <p className="font-medium">{preset.name}</p>
                        <p className="text-muted-foreground">{preset.cpuCores} CPU · {preset.ramMb}MB</p>
                        <p className="text-muted-foreground">${preset.estimatedMonthlyUsd}/mo</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setServices((prev) => [...prev, newDraftService({ name: `service-${prev.length + 1}` })])}>
              <Plus className="h-3.5 w-3.5" /> Add Service
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Deploy</CardTitle>
            <CardDescription>Confirm your architecture before deploying.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <span className="text-muted-foreground">Project</span>
              <span className="font-medium">{name} ({slug})</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <span className="text-muted-foreground">Region</span>
              <span className="font-medium">{region}</span>
            </div>
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{s.name}</span>
                  <StatusBadge status="QUEUED" />
                </div>
                <span className="text-muted-foreground">{formatCurrency(RESOURCE_PRESETS.find((p) => p.id === s.resourcePreset)?.estimatedMonthlyUsd ?? 0)}/mo</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="font-medium">Estimated Monthly Cost</span>
              <span className="text-lg font-semibold">{formatCurrency(estimatedCost)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < 2 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={(step === 0 && !canContinueFromProject) || (step === 1 && !canContinueFromServices)}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleDeploy} loading={isDeploying} size="lg">
            <Rocket className="h-4 w-4" /> Deploy Full Stack
          </Button>
        )}
      </div>
    </div>
  );
}
