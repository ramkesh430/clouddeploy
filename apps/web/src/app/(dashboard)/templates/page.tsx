"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Database, Layers, Rocket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTemplateCategories, useTemplates, useDeployTemplate, type Template } from "@/hooks/use-templates";
import { formatCurrency } from "@/lib/utils";

export default function TemplatesPage() {
  const router = useRouter();
  const { active } = useActiveOrganization();
  const { data: categories } = useTemplateCategories();
  const { data: templates } = useTemplates(active?.id);
  const [deployTarget, setDeployTarget] = useState<Template | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm text-muted-foreground">
          One-click deploy real, self-hosted apps — a real project, service, and (where needed) a real managed database are provisioned for you.
        </p>
      </div>

      {(categories ?? []).map((cat) => {
        const inCategory = (templates ?? []).filter((t) => t.categoryId === cat.id);
        if (inCategory.length === 0) return null;
        return (
          <div key={cat.id} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{cat.name}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inCategory.map((t) => (
                <Card key={t.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/templates/${t.id}`} className="flex items-center gap-2.5 hover:opacity-80">
                        {t.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <p className="font-semibold">{t.name}</p>
                      </Link>
                      {t.isFeatured && <Badge variant="secondary">Featured</Badge>}
                    </div>
                    <p className="flex-1 text-sm text-muted-foreground">{t.description}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {t.servicesJson.needsDatabase && (
                        <Badge variant="outline"><Database className="h-3 w-3" /> Postgres</Badge>
                      )}
                      {t.servicesJson.needsRedis && <Badge variant="outline">Redis</Badge>}
                      <Badge variant="muted">~{formatCurrency(t.estimatedMonthlyUsd)}/mo</Badge>
                    </div>
                    <Button size="sm" aria-label={`Deploy ${t.name}`} onClick={() => setDeployTarget(t)}>
                      <Rocket className="h-3.5 w-3.5" /> Deploy
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {deployTarget && (
        <DeployDialog
          template={deployTarget}
          organizationId={active?.id ?? null}
          onOpenChange={(open) => !open && setDeployTarget(null)}
          onDeployed={(projectId) => {
            setDeployTarget(null);
            router.push(`/projects/${projectId}`);
          }}
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
  template: Template;
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
