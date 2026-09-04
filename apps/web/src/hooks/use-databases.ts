"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface DatabaseSummary {
  id: string;
  name: string;
  engine: string;
  version: string;
  status: string;
  region: string;
  storageMb: number;
  storageUsedMb: number;
  createdAt: string;
  _count?: { backups: number; connections: number };
}

export function useDatabases(organizationId: string | null) {
  return useQuery({
    queryKey: ["databases", organizationId],
    queryFn: () => api.get<DatabaseSummary[]>(`/databases?organizationId=${organizationId}`),
    enabled: !!organizationId,
    refetchInterval: 10_000,
  });
}

export function useDatabaseConnection(databaseId: string | null) {
  return useQuery({
    queryKey: ["database-connection", databaseId],
    queryFn: () => api.get(`/databases/${databaseId}/connection`),
    enabled: !!databaseId,
  });
}

export function useDatabaseBackups(databaseId: string | null) {
  return useQuery({
    queryKey: ["database-backups", databaseId],
    queryFn: () => api.get<any[]>(`/databases/${databaseId}/backups`),
    enabled: !!databaseId,
  });
}

export function useCreateDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationId: string; name: string; engine: string; region?: string; resourcePreset?: string }) =>
      api.post<DatabaseSummary>("/databases", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["databases"] });
      toast({ title: "Database created", description: "Provisioning your database now.", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Could not create database", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useCreateBackup(databaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/databases/${databaseId}/backup`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["database-backups", databaseId] });
      toast({ title: "Backup started", variant: "success" });
    },
  });
}

export function useRotatePassword(databaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ newPassword: string }>(`/databases/${databaseId}/rotate-password`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["database-connection", databaseId] });
      toast({ title: "Password rotated", variant: "success" });
    },
  });
}
