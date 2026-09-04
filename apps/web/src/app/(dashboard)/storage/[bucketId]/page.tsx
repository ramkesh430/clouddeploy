"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronRight, Folder, File as FileIcon, Upload, FolderPlus, Trash2, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useBucketObjects, useCreateFolder, useDeleteObject, useSignedUrl, uploadFile } from "@/hooks/use-storage";
import { useQueryClient } from "@tanstack/react-query";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import { toast } from "@/lib/store/toast-store";

export default function BucketDetailPage() {
  const params = useParams<{ bucketId: string }>();
  const [prefix, setPrefix] = useState("");
  const { data, isLoading } = useBucketObjects(params.bucketId, prefix);
  const createFolder = useCreateFolder(params.bucketId);
  const deleteObject = useDeleteObject(params.bucketId);
  const signedUrl = useSignedUrl(params.bucketId);
  const queryClient = useQueryClient();

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const breadcrumbs = prefix.split("/").filter(Boolean);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(params.bucketId, `${prefix}${file.name}`, file);
      }
      queryClient.invalidateQueries({ queryKey: ["bucket-objects", params.bucketId] });
      toast({ title: `Uploaded ${files.length} file${files.length > 1 ? "s" : ""}`, variant: "success" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setPrefix("")} className="text-primary hover:underline">
            {data?.bucket.name ?? "bucket"}
          </button>
          {breadcrumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                onClick={() => setPrefix(breadcrumbs.slice(0, i + 1).join("/") + "/")}
                className="text-primary hover:underline"
              >
                {part}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFolderDialogOpen(true)}>
            <FolderPlus className="h-3.5 w-3.5" /> New Folder
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
            <Upload className="h-3.5 w-3.5" /> Upload File
          </Button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Size</th>
                <th className="p-4 font-medium">Updated</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.folders ?? []).map((folder) => {
                const name = folder.slice(prefix.length).replace(/\/$/, "");
                return (
                  <tr key={folder} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-accent/40" onClick={() => setPrefix(folder)}>
                    <td className="p-4 font-medium"><span className="flex items-center gap-2"><Folder className="h-4 w-4 text-primary" /> {name}</span></td>
                    <td className="p-4 text-muted-foreground">Folder</td>
                    <td className="p-4 text-muted-foreground">—</td>
                    <td className="p-4 text-muted-foreground">—</td>
                    <td className="p-4" />
                  </tr>
                );
              })}
              {(data?.files ?? []).map((file) => (
                <tr key={file.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4"><span className="flex items-center gap-2"><FileIcon className="h-4 w-4 text-muted-foreground" /> {file.name}</span></td>
                  <td className="p-4 text-muted-foreground">{file.contentType ?? "—"}</td>
                  <td className="p-4 text-muted-foreground">{formatBytes(file.sizeBytes)}</td>
                  <td className="p-4 text-muted-foreground">{formatRelativeTime(file.updatedAt)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          signedUrl.mutate(file.id, {
                            onSuccess: (res) => {
                              navigator.clipboard.writeText(res.url);
                              toast({ title: "Signed URL copied" });
                            },
                          })
                        }
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteObject.mutate(file.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && (data?.folders ?? []).length === 0 && (data?.files ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">This folder is empty.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create folder</DialogTitle></DialogHeader>
          <Input placeholder="folder-name" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
          <DialogFooter>
            <Button
              disabled={!folderName}
              loading={createFolder.isPending}
              onClick={() =>
                createFolder.mutate(`${prefix}${folderName}`, {
                  onSuccess: () => { setFolderDialogOpen(false); setFolderName(""); },
                })
              }
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
