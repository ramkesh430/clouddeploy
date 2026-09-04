"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Table2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTables, useTableRows } from "@/hooks/use-database-manager";
import { cn } from "@/lib/utils";

export default function TableBrowserPage() {
  const params = useParams<{ databaseId: string }>();
  const { data: tables, isLoading: tablesLoading, refetch } = useTables(params.databaseId);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const activeTable = selectedTable ?? tables?.[0]?.name ?? null;
  const { data: rows, isLoading: rowsLoading } = useTableRows(params.databaseId, activeTable, page);

  const totalPages = rows ? Math.max(1, Math.ceil(rows.totalRows / 50)) : 1;
  const columnCount = rows ? Math.max(1, rows.columns.length) : 1;

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Card>
        <CardContent className="p-2">
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <span className="text-xs font-medium text-muted-foreground">Tables</span>
            <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
          {tablesLoading && <p className="px-2 py-2 text-xs text-muted-foreground">Loading...</p>}
          {!tablesLoading && (tables ?? []).length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">No tables yet — create one from the SQL Editor.</p>
          )}
          <div className="flex flex-col">
            {(tables ?? []).map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  setSelectedTable(t.name);
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  activeTable === t.name ? "bg-primary/10 text-primary" : "hover:bg-accent",
                )}
              >
                <Table2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!activeTable ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Select a table to browse its rows.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      {(rows?.columns ?? []).map((c) => (
                        <th key={c} className="whitespace-nowrap p-3 font-medium">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsLoading && (
                      <tr><td className="p-4 text-muted-foreground" colSpan={columnCount}>Loading...</td></tr>
                    )}
                    {(rows?.rows ?? []).map((row, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        {(rows?.columns ?? []).map((c) => (
                          <td key={c} className="whitespace-nowrap p-3 font-mono text-xs">
                            {row[c] === null ? <span className="text-muted-foreground">NULL</span> : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!rowsLoading && (rows?.rows ?? []).length === 0 && (
                      <tr><td className="p-8 text-center text-muted-foreground" colSpan={columnCount}>No rows.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-border p-3 text-xs text-muted-foreground">
                <span>{rows?.totalRows ?? 0} rows</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span>Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
