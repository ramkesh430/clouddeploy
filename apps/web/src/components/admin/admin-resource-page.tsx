"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminResource } from "@/hooks/use-phase3";

export interface AdminColumn { key: string; label: string }

export function AdminResourcePage({ title, description, endpoint, columns }: { title: string; description: string; endpoint: string; columns: AdminColumn[] }) {
  const { data, isLoading, error } = useAdminResource<unknown>(endpoint);
  const rows = Array.isArray(data) ? data : data && typeof data === "object" && "data" in data ? (data as { data: unknown[] }).data : data ? [data] : [];
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="text-sm text-muted-foreground">{description}</p></div><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>{title}</CardTitle><Badge variant="outline">{rows.length} records</Badge></div></CardHeader><CardContent className="overflow-x-auto p-0">{isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : error ? <p className="p-6 text-sm text-destructive">{(error as Error).message}</p> : <table className="w-full min-w-[720px] text-left text-sm"><thead className="border-y bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr>{columns.map((column) => <th className="px-4 py-3 font-medium" key={column.key}>{column.label}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={String(valueAt(row, "id") ?? index)} className="hover:bg-muted/30">{columns.map((column) => <td className="max-w-[280px] truncate px-4 py-3" key={column.key}>{formatValue(valueAt(row, column.key))}</td>)}</tr>)}</tbody></table>}</CardContent></Card></div>;
}

function valueAt(row: unknown, key: string): unknown { return key.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, row); }
function formatValue(value: unknown) { if (value == null) return <span className="text-muted-foreground">—</span>; if (typeof value === "boolean") return value ? "Yes" : "No"; if (typeof value === "object") return JSON.stringify(value); if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value).toLocaleString(); return String(value); }
