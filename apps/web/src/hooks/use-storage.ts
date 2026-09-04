"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { API_URL } from "@/lib/api-client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/store/toast-store";

export interface Bucket {
  id: string;
  name: string;
  isPublic: boolean;
  maxFileSizeMb: number;
  totalSizeBytes: number;
  _count: { objects: number };
  createdAt: string;
}

export interface StorageFile {
  id: string;
  key: string;
  name: string;
  sizeBytes: number;
  contentType: string | null;
  isPublic: boolean;
  updatedAt: string;
}

export interface ListObjectsResult {
  bucket: Bucket;
  folders: string[];
  files: StorageFile[];
}

export function useBuckets(organizationId: string | null) {
  return useQuery({
    queryKey: ["buckets", organizationId],
    queryFn: () => api.get<Bucket[]>(`/storage/buckets?organizationId=${organizationId}`),
    enabled: !!organizationId,
  });
}

export function useCreateBucket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationId: string; name: string; isPublic?: boolean }) =>
      api.post<Bucket>("/storage/buckets", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buckets"] });
      toast({ title: "Bucket created", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Could not create bucket", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useBucketObjects(bucketId: string | null, prefix: string) {
  return useQuery({
    queryKey: ["bucket-objects", bucketId, prefix],
    queryFn: () => api.get<ListObjectsResult>(`/storage/buckets/${bucketId}/objects?prefix=${encodeURIComponent(prefix)}`),
    enabled: !!bucketId,
  });
}

export function useCreateFolder(bucketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.post(`/storage/buckets/${bucketId}/folders`, { key }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bucket-objects", bucketId] }),
  });
}

export function useDeleteObject(bucketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (objectId: string) => api.delete(`/storage/buckets/${bucketId}/objects/${objectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bucket-objects", bucketId] });
      toast({ title: "Deleted" });
    },
  });
}

export function useSignedUrl(bucketId: string) {
  return useMutation({
    mutationFn: (objectId: string) => api.get<{ url: string }>(`/storage/buckets/${bucketId}/objects/${objectId}/signed-url`),
  });
}

export async function uploadFile(bucketId: string, key: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("key", key);
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/api/v1/storage/buckets/${bucketId}/objects`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new ApiError(res.status, json?.error?.code ?? "UPLOAD_FAILED", json?.error?.message ?? "Upload failed");
  }
}
