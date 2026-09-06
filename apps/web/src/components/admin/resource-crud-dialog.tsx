"use client";

import { FormEvent, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminResource } from "@/hooks/use-phase3";
import { useRegions } from "@/hooks/use-phase3";

export type FieldValue = string | number | boolean;

export type DynamicSource = "organizations" | "regions" | "plans" | "projects";

export interface ResourceField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  required?: boolean;
  /** Static <select> choices. Ignored for "text"/"number"/"checkbox". */
  options?: Array<{ value: string; label: string }>;
  /** Populates a "select" field's options from live admin data instead of a
   * fixed list. */
  dynamicSource?: DynamicSource;
  /** For dynamicSource "projects": only offer projects belonging to the
   * organization currently selected in this other field. */
  dependsOn?: string;
  placeholder?: string;
}

interface OrgOption { id: string; name: string }
interface PlanOption { id: string; name: string; tier: string }
interface ProjectOption { id: string; name: string; organizationId: string }
interface Paginated<T> { data: T[]; nextCursor: string | null }

function useDynamicOptions(source: DynamicSource | undefined, dependsOnValue: FieldValue | undefined) {
  const organizations = useAdminResource<Paginated<OrgOption>>("/admin/organizations?limit=200", { enabled: source === "organizations" });
  const regions = useRegions();
  const plans = useAdminResource<PlanOption[]>("/admin/plans", { enabled: source === "plans" });
  const projects = useAdminResource<Paginated<ProjectOption>>("/admin/projects?limit=200", { enabled: source === "projects" });

  if (source === "organizations") return (organizations.data?.data ?? []).map((org) => ({ value: org.id, label: org.name }));
  if (source === "regions") return (regions.data ?? []).map((region) => ({ value: region.code, label: region.name }));
  if (source === "plans") return (plans.data ?? []).map((plan) => ({ value: plan.id, label: `${plan.name} (${plan.tier})` }));
  if (source === "projects") {
    const list = projects.data?.data ?? [];
    const filtered = dependsOnValue ? list.filter((project) => project.organizationId === dependsOnValue) : list;
    return filtered.map((project) => ({ value: project.id, label: project.name }));
  }
  return [];
}

function FieldInput({ field, value, dependsOnValue, onChange }: { field: ResourceField; value: FieldValue; dependsOnValue: FieldValue | undefined; onChange: (value: FieldValue) => void }) {
  const dynamicOptions = useDynamicOptions(field.dynamicSource, dependsOnValue);
  const options = field.dynamicSource ? dynamicOptions : (field.options ?? []);

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }

  if (field.type === "select") {
    const waitingOnDependency = !!field.dependsOn && !dependsOnValue;
    return (
      <select
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        value={String(value ?? "")}
        required={field.required}
        disabled={waitingOnDependency}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {waitingOnDependency ? "Select an organization first…" : `Select ${field.label.toLowerCase()}…`}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Input
      type={field.type === "number" ? "number" : "text"}
      required={field.required}
      placeholder={field.placeholder}
      value={value === undefined || value === false ? "" : String(value)}
      onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
    />
  );
}

/** A single generic dialog reused for both "create" and "edit" — driven by
 * a field-schema per resource rather than a bespoke form per entity, since
 * every admin CRUD form here is the same shape: a handful of labeled inputs
 * submitted as one JSON body. */
export function ResourceCrudDialog({
  open,
  onOpenChange,
  title,
  fields,
  initialValues,
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: ResourceField[];
  initialValues?: Record<string, FieldValue>;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (values: Record<string, FieldValue>) => void;
}) {
  const [values, setValues] = useState<Record<string, FieldValue>>({});

  useEffect(() => {
    if (open) setValues(initialValues ?? {});
    // Only reset when the dialog transitions open — not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          {fields.map((field) => (
            <div className="flex flex-col gap-1.5" key={field.key}>
              {field.type !== "checkbox" && <Label>{field.label}</Label>}
              <FieldInput
                field={field}
                value={values[field.key]}
                dependsOnValue={field.dependsOn ? values[field.dependsOn] : undefined}
                onChange={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
              />
            </div>
          ))}
          {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
