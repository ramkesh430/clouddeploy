"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useAdminResource } from "@/hooks/use-phase3";
import { ResourceCrudDialog, type FieldValue, type ResourceField } from "@/components/admin/resource-crud-dialog";

export interface AdminColumn { key: string; label: string }

export interface ResourceCrudConfig {
  createFields?: ResourceField[];
  editFields?: ResourceField[];
  canDelete?: boolean;
  /** Only when creation posts somewhere other than the list endpoint. */
  createEndpoint?: string;
}

export function AdminResourcePage({ title, description, endpoint, columns, crud }: { title: string; description: string; endpoint: string; columns: AdminColumn[]; crud?: ResourceCrudConfig }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useAdminResource<unknown>(endpoint);
  const rows = Array.isArray(data) ? data : data && typeof data === "object" && "data" in data ? (data as { data: unknown[] }).data : data ? [data] : [];

  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; row?: Record<string, unknown> } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", endpoint] });
  }

  const createMutation = useMutation({
    mutationFn: (values: Record<string, FieldValue>) => api.post(crud?.createEndpoint ?? endpoint, values),
    onSuccess: () => { invalidate(); setDialog(null); setFormError(null); },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Something went wrong"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, FieldValue> }) => api.patch(`${endpoint}/${id}`, values),
    onSuccess: () => { invalidate(); setDialog(null); setFormError(null); },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Something went wrong"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${endpoint}/${id}`),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Delete failed"),
  });

  function askDelete(row: Record<string, unknown>) {
    const label = typeof row.name === "string" ? row.name : typeof row.hostname === "string" ? row.hostname : typeof row.email === "string" ? row.email : String(row.id);
    if (window.confirm(`Delete "${label}"? This cannot be undone.`)) deleteMutation.mutate(String(row.id));
  }

  const showActions = !!(crud?.editFields || crud?.canDelete);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {crud?.createFields && (
          <Button onClick={() => { setFormError(null); setDialog({ mode: "create" }); }}>
            <Plus className="h-4 w-4" /> New
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{title}</CardTitle>
            <Badge variant="outline">{rows.length} records</Badge>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="p-6 text-sm text-destructive">{(error as Error).message}</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-y bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {columns.map((column) => <th className="px-4 py-3 font-medium" key={column.key}>{column.label}</th>)}
                  {showActions && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, index) => (
                  <tr key={String(valueAt(row, "id") ?? index)} className="hover:bg-muted/30">
                    {columns.map((column) => <td className="max-w-[280px] truncate px-4 py-3" key={column.key}>{formatValue(valueAt(row, column.key))}</td>)}
                    {showActions && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {crud?.editFields && (
                            <Button size="sm" variant="outline" onClick={() => { setFormError(null); setDialog({ mode: "edit", row: row as Record<string, unknown> }); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {crud?.canDelete && (
                            <Button size="sm" variant="destructive" disabled={deleteMutation.isPending} onClick={() => askDelete(row as Record<string, unknown>)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {crud?.createFields && (
        <ResourceCrudDialog
          open={dialog?.mode === "create"}
          onOpenChange={(open) => !open && setDialog(null)}
          title={`New ${title.replace(/s$/, "")}`}
          fields={crud.createFields}
          submitLabel="Create"
          pending={createMutation.isPending}
          error={formError}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}
      {crud?.editFields && dialog?.mode === "edit" && dialog.row && (
        <ResourceCrudDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Edit ${title.replace(/s$/, "")}`}
          fields={crud.editFields}
          initialValues={Object.fromEntries(crud.editFields.map((field) => [field.key, valueAt(dialog.row, field.key) as FieldValue]))}
          submitLabel="Save changes"
          pending={updateMutation.isPending}
          error={formError}
          onSubmit={(values) => updateMutation.mutate({ id: String(dialog.row!.id), values })}
        />
      )}
    </div>
  );
}

function valueAt(row: unknown, key: string): unknown { return key.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, row); }
function formatValue(value: unknown) { if (value == null) return <span className="text-muted-foreground">—</span>; if (typeof value === "boolean") return value ? "Yes" : "No"; if (typeof value === "object") return JSON.stringify(value); if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value).toLocaleString(); return String(value); }
