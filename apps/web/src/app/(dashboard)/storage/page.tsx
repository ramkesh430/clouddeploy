"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, HardDrive, Files, Folder } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useBuckets, useCreateBucket } from "@/hooks/use-storage";
import { formatBytes, formatRelativeTime } from "@/lib/utils";

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
            <Button>
              <Plus className="h-4 w-4" /> Create Bucket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a storage bucket</DialogTitle>
            </DialogHeader>
            <Input placeholder="uploads" value={name} onChange={(e) => setName(e.target.value)} />
            <DialogFooter>
              <Button
                loading={createBucket.isPending}
                onClick={() =>
                  active &&
                  createBucket.mutate(
                    { organizationId: active.id, name },
                    {
                      onSuccess: () => {
                        setOpen(false);
                        setName("");
                      },
                    },
                  )
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
          {
            label: "Total Storage",
            value: formatBytes(totalStorage),
            icon: HardDrive,
            color: "text-primary bg-primary/10",
          },
          {
            label: "Buckets",
            value: buckets?.length ?? 0,
            icon: HardDrive,
            color: "text-secondary bg-secondary/10",
          },
          { label: "Files", value: totalFiles, icon: Files, color: "text-success bg-success/10" },
          { label: "Bandwidth", value: "—", icon: Files, color: "text-warning bg-warning/10" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <span className="text-2xl font-bold tracking-tight">{c.value}</span>
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && (buckets ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="No Buckets"
              description="Create a bucket to start storing files."
              action={{ label: "Create Bucket", href: "#", icon: Plus }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Access</th>
                    <th className="px-5 py-3 font-medium">Objects</th>
                    <th className="px-5 py-3 font-medium">Size</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(buckets ?? []).map((b) => (
                    <tr key={b.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <Link href={`/storage/${b.id}`} className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Folder className="h-4 w-4" />
                          </div>
                          <span className="font-medium hover:text-primary">{b.name}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={b.isPublic ? "warning" : "outline"}>
                          {b.isPublic ? "Public" : "Private"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{b._count.objects.toLocaleString()}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatBytes(b.totalSizeBytes)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatRelativeTime(b.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
