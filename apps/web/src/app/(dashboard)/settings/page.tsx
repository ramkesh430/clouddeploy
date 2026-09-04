"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { useActiveOrganization } from "@/hooks/use-active-organization";

export default function OrganizationSettingsPage() {
  const { active } = useActiveOrganization();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">General information, security and danger zone.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic workspace information.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{active?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Slug</p>
            <p className="font-mono font-medium">{active?.slug ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <ComingSoon
        title="Security, API & Audit Logs"
        description="2FA enforcement, API access controls, and organization-wide audit log export land in Phase 2."
      />
    </div>
  );
}
