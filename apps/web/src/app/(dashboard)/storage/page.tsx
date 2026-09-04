import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function StoragePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storage</h1>
        <p className="text-sm text-muted-foreground">S3-compatible object storage buckets.</p>
      </div>
      <ComingSoon
        title="Object Storage"
        description="Bucket creation, file browser, signed URLs and CORS controls are built on top of the MinIO/S3 adapter landing in Phase 2."
      />
    </div>
  );
}
