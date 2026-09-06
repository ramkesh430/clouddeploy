"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, ArrowLeft, ArrowRight, Rocket, Server, Globe, Github, Database, Layers, LayoutTemplate, Container, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useCreateProject } from "@/hooks/use-projects";
import { useCreateService } from "@/hooks/use-services";
import { useCreateDeployment } from "@/hooks/use-deployments";
import { useDetectStack, usePublicDetectStack, useImportRepository } from "@/hooks/use-github";
import { api } from "@/lib/api-client";
import { RESOURCE_PRESETS, ServiceType, Runtime, Framework } from "@clouddeploy/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/store/toast-store";

const STEPS = ["Project", "Services", "Review", "Deploy"] as const;

interface DraftService {
  id: string;
  name: string;
  type: ServiceType;
  runtime: Runtime;
  framework?: Framework;
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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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

  // GitHub import params — either an authenticated connection+repo, or a
  // public repo detected without any GitHub connection at all.
  const connectionId = searchParams.get("connectionId");
  const ghOwner = searchParams.get("owner");
  const ghRepo = searchParams.get("repo");
  const ghBranch = searchParams.get("branch") ?? undefined;
  const publicOwner = searchParams.get("publicOwner");
  const publicRepo = searchParams.get("publicRepo");
  const isGithubImport = !!(connectionId && ghOwner && ghRepo) || !!(publicOwner && publicRepo);

  const { active } = useActiveOrganization();
  const createProject = useCreateProject();
  const createService = useCreateService();
  const createDeployment = useCreateDeployment();
  const detectStack = useDetectStack();
  const publicDetectStack = usePublicDetectStack();
  const importRepository = useImportRepository();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [region, setRegion] = useState("us-east");
  const [services, setServices] = useState<DraftService[]>([
    newDraftService(dockerMode ? { name: "app", type: ServiceType.DOCKER_SERVICE, runtime: Runtime.DOCKER, port: "8080" } : {}),
  ]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [detected, setDetected] = useState<{ database: { engine: string; reason: string } | null; redis: { reason: string } | null } | null>(null);
  const [addDatabase, setAddDatabase] = useState(false);
  const [addRedis, setAddRedis] = useState(false);
  const [detecting, setDetecting] = useState(isGithubImport);
  // Detected services start collapsed to a summary row (mirroring what the
  // stack detector already found); a manually-added service starts expanded
  // since its fields are still blank and need immediate attention.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => (isGithubImport ? new Set() : new Set(services.map((s) => s.id))));
  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    if (!isGithubImport) return;
    const run = connectionId && ghOwner && ghRepo
      ? detectStack.mutateAsync({ connectionId, owner: ghOwner, repo: ghRepo, branch: ghBranch })
      : publicOwner && publicRepo
        ? publicDetectStack.mutateAsync({ owner: publicOwner, repo: publicRepo })
        : null;
    if (!run) return;

    run
      .then((result) => {
        const repoName = result.repositoryFullName.split("/")[1] ?? result.repositoryFullName;
        setName(repoName);
        setSlug(slugify(repoName));
        setSlugTouched(true);
        if (result.services.length > 0) {
          setServices(
            result.services.map((s) =>
              newDraftService({
                name: s.name,
                type: s.type,
                runtime: s.runtime,
                framework: s.framework,
                rootDirectory: s.rootDirectory,
                buildCommand: s.buildCommand ?? "",
                startCommand: s.startCommand ?? "",
                port: s.port ? String(s.port) : "",
              }),
            ),
          );
        }
        setDetected({ database: result.database, redis: result.redis });
        setAddDatabase(!!result.database);
        setAddRedis(!!result.redis);
        toast({ title: "Stack detected", description: `Found ${result.services.length} service(s) in ${result.repositoryFullName}`, variant: "success" });
      })
      .finally(() => setDetecting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateService = (id: string, patch: Partial<DraftService>) =>
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeService = (id: string) => setServices((prev) => prev.filter((s) => s.id !== id));

  const addService = () => {
    const draft = newDraftService({ name: `service-${services.length + 1}` });
    setServices((prev) => [...prev, draft]);
    setExpandedIds((prev) => new Set(prev).add(draft.id));
  };

  const serviceIcon = (type: ServiceType) => {
    if (type === "DOCKER_SERVICE") return Container;
    if (type === "WEB_SERVICE" || type === "STATIC_SITE") return LayoutTemplate;
    return Server;
  };

  const estimatedCost = useMemo(() => {
    const servicesCost = services.reduce((sum, s) => {
      const preset = RESOURCE_PRESETS.find((p) => p.id === s.resourcePreset);
      return sum + (preset?.estimatedMonthlyUsd ?? 0);
    }, 0);
    return servicesCost + (addDatabase ? 5 : 0) + (addRedis ? 2 : 0);
  }, [services, addDatabase, addRedis]);

  const canContinueFromProject = name.trim().length >= 2 && slug.trim().length >= 2;
  const canContinueFromServices = services.length > 0 && services.every((s) => s.name.trim().length > 0);

  const handleDeploy = async () => {
    if (!active) return;
    setIsDeploying(true);
    try {
      const project = await createProject.mutateAsync({ organizationId: active.id, name, slug, region });

      if (connectionId && ghOwner && ghRepo) {
        await importRepository.mutateAsync({
          projectId: project.id,
          connectionId,
          fullName: `${ghOwner}/${ghRepo}`,
          branch: ghBranch,
        });
      }

      for (const s of services) {
        await createService.mutateAsync({
          projectId: project.id,
          name: s.name,
          type: s.type,
          runtime: s.runtime,
          framework: s.framework,
          rootDirectory: s.rootDirectory || ".",
          buildCommand: s.buildCommand || undefined,
          startCommand: s.startCommand || undefined,
          port: s.port ? Number(s.port) : undefined,
          resourcePreset: s.resourcePreset,
        });
      }

      if (addDatabase && detected?.database) {
        await api.post("/databases", {
          organizationId: active.id,
          name: `${slug}-db`,
          engine: detected.database.engine,
        });
      }
      if (addRedis) {
        await api.post("/redis", { projectId: project.id, name: `${slug}-cache` });
      }

      createDeployment.mutate({ projectId: project.id, branch: ghBranch });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className={`mx-auto flex w-full flex-col gap-6 ${step === 1 ? "max-w-4xl" : "max-w-2xl"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={i === step ? "font-medium text-foreground" : ""}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {detecting && (
        <Card>
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <Github className="h-4 w-4 animate-pulse" /> Detecting your stack...
          </CardContent>
        </Card>
      )}

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
        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader>
              <CardTitle>{isGithubImport ? "Detected Services" : "Services"}</CardTitle>
              <CardDescription>
                {isGithubImport ? "Review what we found, then edit anything before deploying." : "Add one service per process — frontend, backend, worker, etc."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {services.map((s) => {
                const Icon = serviceIcon(s.type);
                const expanded = expandedIds.has(s.id);
                return (
                  <div key={s.id} className="flex flex-col gap-3 rounded-md border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {s.framework && s.framework !== "UNKNOWN" ? s.framework.replace(/_/g, " ") : s.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">directory: {s.rootDirectory}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => toggleExpanded(s.id)}>
                          {expanded ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                          {expanded ? "Done" : "Edit"}
                        </Button>
                        {services.length > 1 && (
                          <button onClick={() => removeService(s.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <>
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
                      </>
                    )}
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="w-fit" onClick={addService}>
                <Plus className="h-3.5 w-3.5" /> Add Service
              </Button>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Project Name</span>
                <span className="text-sm font-medium">{name || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Region</span>
                <span className="text-sm font-medium">{region}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Domain</span>
                <span className="truncate text-sm font-medium">{slug || "—"}.clouddeploy.app</span>
                <span className="text-xs text-muted-foreground">You can add a custom domain later.</span>
              </div>
              {(detected?.database || detected?.redis) && (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  {detected.database && (
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={addDatabase} onChange={(e) => setAddDatabase(e.target.checked)} className="mt-0.5 h-4 w-4" />
                      <span className="flex items-start gap-1.5">
                        <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>Provision {detected.database.engine === "POSTGRESQL" ? "PostgreSQL" : "MySQL"} — {detected.database.reason}</span>
                      </span>
                    </label>
                  )}
                  {detected.redis && (
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={addRedis} onChange={(e) => setAddRedis(e.target.checked)} className="mt-0.5 h-4 w-4" />
                      <span className="flex items-start gap-1.5">
                        <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>Provision Redis — {detected.redis.reason}</span>
                      </span>
                    </label>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="font-medium">Estimated cost</span>
                <span className="font-semibold">{formatCurrency(estimatedCost)}/mo</span>
              </div>
            </CardContent>
          </Card>
        </div>
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
            {addDatabase && detected?.database && (
              <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{detected.database.engine === "POSTGRESQL" ? "PostgreSQL" : "MySQL"}</span>
                </div>
                <span className="text-muted-foreground">{formatCurrency(5)}/mo</span>
              </div>
            )}
            {addRedis && (
              <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Redis</span>
                </div>
                <span className="text-muted-foreground">{formatCurrency(2)}/mo</span>
              </div>
            )}
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
