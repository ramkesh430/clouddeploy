"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";
import { useAdminResource } from "@/hooks/use-phase3";

interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultRegion: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
}

interface RegionRecord {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export default function AdminSettingsPage() {
  const client = useQueryClient();
  const { data: settings } = useAdminResource<PlatformSettings>("/admin/settings");
  const { data: regions = [] } = useAdminResource<RegionRecord[]>("/admin/infrastructure/regions");

  const [form, setForm] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  const save = useMutation({
    mutationFn: (values: PlatformSettings) => api.patch<PlatformSettings>("/admin/settings", values),
    onSuccess: (updated) => {
      client.setQueryData(["admin", "/admin/settings"], updated);
      toast({ title: "Settings saved", variant: "success" });
    },
    onError: (err) => {
      toast({
        title: "Could not save settings",
        description: err instanceof ApiError ? err.message : "Try again",
        variant: "destructive",
      });
    },
  });

  if (!form) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Platform configuration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Shown to your customers across the app and outbound email.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Platform Name</Label>
              <Input
                value={form.platformName}
                onChange={(e) => setForm({ ...form, platformName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Support Email</Label>
              <Input
                type="email"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:w-1/2 sm:pr-2">
            <Label>Default Region</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.defaultRegion}
              onChange={(e) => setForm({ ...form, defaultRegion: e.target.value })}
            >
              {regions.filter((r) => r.active).length === 0 && (
                <option value={form.defaultRegion}>{form.defaultRegion}</option>
              )}
              {regions
                .filter((r) => r.active)
                .map((r) => (
                  <option key={r.id} value={r.code}>
                    {r.name} ({r.code})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-4">
            <div>
              <p className="text-sm font-medium">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">
                Show a maintenance banner and block new deployments platform-wide.
              </p>
            </div>
            <button
              onClick={() => setForm({ ...form, maintenanceMode: !form.maintenanceMode })}
              className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${form.maintenanceMode ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${form.maintenanceMode ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
          </div>

          {form.maintenanceMode && (
            <div className="flex flex-col gap-1.5">
              <Label>Maintenance Message</Label>
              <Input
                placeholder="We're performing scheduled maintenance — back shortly."
                value={form.maintenanceMessage ?? ""}
                onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button loading={save.isPending} onClick={() => save.mutate(form)}>
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
