"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, HardDrive, Files } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useBuckets, useCreateBucket } from "@/hooks/use-storage";
import { formatBytes } from "@/lib/utils";

export default function StoragePage() {
  const { active } = useActiveOrganization();
  const { data: buckets, isLoading } = useBuckets(active?.id ?? null);
  const createBucket = useCreateBucket();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const totalStorage = (buckets ?? []).reduce((sum, b) => sum + b.totalSizeBytes, 0);
  const totalFiles = (buckets ?? []).reduce((sum, b) => sum + b._count.objects, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Storage</h1>
          <p className="text-sm text-muted-foreground">S3-compatible object storage buckets.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Create Bucket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a storage bucket</DialogTitle></DialogHeader>
            <Input placeholder="uploads" value={name} onChange={(e) => setName(e.target.value)} />
            <DialogFooter>
              <Button
                loading={createBucket.isPending}
                onClick={() =>
                  active && createBucket.mutate({ organizationId: active.id, name }, { onSuccess: () => { setOpen(false); setName(""); } })
                }
              >
                Create Bucket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Storage", value: formatBytes(totalStorage), icon: HardDrive },
          { label: "Buckets", value: buckets?.length ?? 0, icon: HardDrive },
          { label: "Files", value: totalFiles, icon: Files },
          { label: "Bandwidth", value: "—", icon: Files },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <span className="text-xl font-semibold">{c.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && (buckets ?? []).length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState title="No Buckets" description="Create a bucket to start storing files." action={{ label: "Create Bucket", href: "#", icon: Plus }} /></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(buckets ?? []).map((b) => (
            <Link key={b.id} href={`/storage/${b.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{b.name}</p>
                    <Badge variant={b.isPublic ? "warning" : "outline"}>{b.isPublic ? "Public" : "Private"}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{b._count.objects} files</span>
                    <span>{formatBytes(b.totalSizeBytes)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
