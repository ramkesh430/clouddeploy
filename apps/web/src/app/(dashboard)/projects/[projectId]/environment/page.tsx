"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Eye, EyeOff, Copy, Trash2, Plus, ClipboardPaste, Lock, Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useEnvironmentVariables,
  useCreateEnvVar,
  useDeleteEnvVar,
  useBulkImportEnvVars,
  useRevealEnvVar,
} from "@/hooks/use-environment-variables";
import { toast } from "@/lib/store/toast-store";

export default function ProjectEnvironmentPage() {
  const params = useParams<{ projectId: string }>();
  const { data: envVars } = useEnvironmentVariables(params.projectId);
  const createEnvVar = useCreateEnvVar();
  const deleteEnvVar = useDeleteEnvVar(params.projectId);
  const bulkImport = useBulkImportEnvVars();
  const reveal = useRevealEnvVar();

  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const toggleReveal = async (id: string) => {
    if (revealed[id]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    const result = await reveal.mutateAsync(id);
    setRevealed((prev) => ({ ...prev, [id]: result.value }));
  };

  const handleAdd = () => {
    if (!key || !value) return;
    createEnvVar.mutate(
      { projectId: params.projectId, key: key.toUpperCase(), value },
      { onSuccess: () => { setKey(""); setValue(""); } },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Variables are encrypted at rest and injected into your services at deploy time.</p>
        <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <ClipboardPaste className="h-3.5 w-3.5" /> Import .env
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Paste .env content</DialogTitle>
            </DialogHeader>
            <textarea
              className="h-40 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
              placeholder={"NODE_ENV=production\nDATABASE_URL=...\nJWT_SECRET=..."}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <DialogFooter>
              <Button
                onClick={() =>
                  bulkImport.mutate(
                    { projectId: params.projectId, raw: pasteText },
                    { onSuccess: () => { setPasteOpen(false); setPasteText(""); } },
                  )
                }
                loading={bulkImport.isPending}
              >
                Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input placeholder="KEY_NAME" value={key} onChange={(e) => setKey(e.target.value)} className="font-mono" />
          </div>
          <div className="flex-1">
            <Input placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" />
          </div>
          <Button onClick={handleAdd} loading={createEnvVar.isPending}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col p-0">
          {(envVars ?? []).map((v) => (
            <div key={v.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {v.isSecret ? <Lock className="h-3.5 w-3.5" /> : <Braces className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-medium">{v.key}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {v.isSecret ? (revealed[v.id] ?? v.value) : v.value}
                </p>
              </div>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{v.environment}</span>
              <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">{new Date(v.updatedAt).toLocaleDateString()}</span>
              <div className="flex shrink-0 items-center gap-1">
                {v.isSecret && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleReveal(v.id)}>
                    {revealed[v.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    navigator.clipboard.writeText(revealed[v.id] ?? v.value);
                    toast({ title: "Copied to clipboard" });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteEnvVar.mutate(v.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {(envVars ?? []).length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No environment variables yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
