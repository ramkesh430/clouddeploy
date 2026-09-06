"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Play, Save, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRunQuery, useSavedQueries, useSaveQuery, useDeleteSavedQuery, type QueryResult } from "@/hooks/use-database-manager";
import { useDatabase } from "@/hooks/use-databases";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading editor...</div> });

/** MySQL/MariaDB have no "public" schema the way Postgres does — a tenant's
 * database IS its own schema there, so filtering by it needs no literal at
 * all, just the tables already visible on this connection. */
function defaultSqlFor(engine: string | undefined): string {
  if (engine === "MYSQL" || engine === "MARIADB") return "SELECT table_name, table_rows FROM information_schema.tables LIMIT 10;";
  return "SELECT * FROM information_schema.tables WHERE table_schema = 'public' LIMIT 10;";
}

export default function SqlEditorPage() {
  const params = useParams<{ databaseId: string }>();
  const { data: database } = useDatabase(params.databaseId);
  const [sql, setSql] = useState<string | null>(null);
  const editorValue = sql ?? defaultSqlFor(database?.engine);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [queryName, setQueryName] = useState("");

  const runQuery = useRunQuery(params.databaseId);
  const { data: savedQueries } = useSavedQueries(params.databaseId);
  const saveQuery = useSaveQuery(params.databaseId);
  const deleteSavedQuery = useDeleteSavedQuery(params.databaseId);

  const handleRun = () => {
    setError(null);
    runQuery.mutate(editorValue, {
      onSuccess: (data) => setResult(data),
      onError: (err: any) => setError(err?.message ?? "Query failed"),
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div className="flex flex-col gap-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">SQL Editor</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSql("")}>
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)}>
                <Save className="h-3.5 w-3.5" /> Save Query
              </Button>
              <Button size="sm" onClick={handleRun} loading={runQuery.isPending}>
                <Play className="h-3.5 w-3.5" /> Run
              </Button>
            </div>
          </div>
          <div className="h-64">
            <MonacoEditor
              language="sql"
              theme="vs-dark"
              value={editorValue}
              onChange={(v) => setSql(v ?? "")}
              options={{ minimap: { enabled: false }, fontSize: 13, padding: { top: 12 } }}
            />
          </div>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
              <span>
                {error
                  ? "Error"
                  : result
                    ? `${result.rowCount} row${result.rowCount === 1 ? "" : "s"} · ${result.durationMs}ms`
                    : "Run a query to see results"}
              </span>
            </div>
            {error && <div className="p-4 font-mono text-xs text-destructive">{error}</div>}
            {!error && result && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      {result.columns.map((c) => (
                        <th key={c} className="whitespace-nowrap p-2.5 font-medium">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        {result.columns.map((c) => (
                          <td key={c} className="whitespace-nowrap p-2.5 font-mono text-xs">
                            {row[c] === null ? <span className="text-muted-foreground">NULL</span> : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {result.rows.length === 0 && (
                      <tr><td className="p-6 text-center text-muted-foreground" colSpan={result.columns.length || 1}>Query returned no rows.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Saved Queries</p>
          <div className="flex flex-col gap-1">
            {(savedQueries ?? []).map((q) => (
              <div key={q.id} className="group flex items-center gap-1 rounded-md hover:bg-accent">
                <button onClick={() => setSql(q.sql)} className="flex-1 truncate px-2 py-1.5 text-left text-xs">
                  {q.name}
                </button>
                <button
                  onClick={() => deleteSavedQuery.mutate(q.id)}
                  className="pr-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {(savedQueries ?? []).length === 0 && <p className="px-2 text-xs text-muted-foreground">No saved queries yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save query</DialogTitle></DialogHeader>
          <Input placeholder="Query name" value={queryName} onChange={(e) => setQueryName(e.target.value)} />
          <DialogFooter>
            <Button
              disabled={!queryName}
              loading={saveQuery.isPending}
              onClick={() =>
                saveQuery.mutate({ name: queryName, sql: editorValue }, { onSuccess: () => { setSaveOpen(false); setQueryName(""); } })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
