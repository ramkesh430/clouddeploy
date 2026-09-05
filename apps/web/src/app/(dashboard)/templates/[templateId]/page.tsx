"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Database, Layers, Rocket, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTemplate, useDeployTemplate } from "@/hooks/use-templates";
import { formatCurrency } from "@/lib/utils";

const SECRET_SHAPED = /SECRET|KEY|PASSWORD|TOKEN|SALT|ENCRYPTION/i;

export default function TemplateDetailPage() {
  const params = useParams<{ templateId: string }>();
  const router = useRouter();
  const { active } = useActiveOrganization();
  const { data: template, isLoading } = useTemplate(params.templateId);
  const [deployOpen, setDeployOpen] = useState(false);

  if (isLoading || !template) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const def = template.servicesJson;
  const services = def.services ?? (def.service ? [def.service] : []);
  const primaryService = services[0];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/templates" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Templates
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {template.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={template.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
              {template.isFeatured && <Badge variant="secondary">Featured</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{template.category.name}</p>
          </div>
        </div>
        <Button onClick={() => setDeployOpen(true)}>
          <Rocket className="h-4 w-4" /> Deploy
        </Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="text-sm">{template.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What Gets Deployed</CardTitle>
          <CardDescription>A real project and service, provisioned the same way a hand-built deploy would be.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Service</p>
              <p className="font-mono">{services.map((service) => service.name).join(", ")}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Docker Image</p>
            <p className="font-mono">{primaryService?.dockerImage ?? "Built from source"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Port</p>
            <p className="font-mono">{services.map((service) => service.port).join(", ")}</p>
          </div>
          {primaryService?.healthCheckPath && (
            <div>
              <p className="text-xs text-muted-foreground">Health Check</p>
              <p className="font-mono">{primaryService.healthCheckPath}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
          <CardDescription>Provisioned automatically on deploy — nothing to configure by hand.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {def.needsDatabase ? (
              <Badge variant="outline"><Database className="h-3 w-3" /> Managed Postgres database</Badge>
            ) : (
              <Badge variant="muted">No managed database needed</Badge>
            )}
            {def.needsRedis && <Badge variant="outline">Managed Redis</Badge>}
            <Badge variant="muted">Resource preset: {def.resourcePreset ?? "starter"}</Badge>
            <Badge variant="muted">~{formatCurrency(template.estimatedMonthlyUsd)}/mo estimated</Badge>
          </div>
          {template.requiredEnvVars.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Environment variables set on deploy</p>
              <div className="flex flex-wrap gap-1.5">
                {template.requiredEnvVars.map((key) => (
                  <Badge key={key} variant="outline" className="font-mono">
                    {key}
                    {!SECRET_SHAPED.test(key) && <span className="text-muted-foreground"> (needs your input)</span>}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {deployOpen && (
        <DeployDialog
          template={template}
          organizationId={active?.id ?? null}
          onOpenChange={setDeployOpen}
          onDeployed={(projectId) => router.push(`/projects/${projectId}`)}
        />
      )}
    </div>
  );
}

function DeployDialog({
  template,
  organizationId,
  onOpenChange,
  onDeployed,
}: {
  template: { id: string; slug: string; name: string; servicesJson: { needsDatabase?: boolean } };
  organizationId: string | null;
  onOpenChange: (open: boolean) => void;
  onDeployed: (projectId: string) => void;
}) {
  const [projectName, setProjectName] = useState(`my-${template.slug}`);
  const deploy = useDeployTemplate(template.id);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deploy {template.name}</DialogTitle>
          <DialogDescription>
            {template.servicesJson.needsDatabase
              ? "This provisions a real managed Postgres database alongside the service."
              : "This provisions a single service — no managed database needed."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label>Project Name</Label>
          <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            loading={deploy.isPending}
            disabled={!projectName || !organizationId}
            onClick={() =>
              organizationId &&
              deploy.mutate(
                { organizationId, projectName },
                { onSuccess: (data) => onDeployed(data.project.id) },
              )
            }
          >
            Deploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
