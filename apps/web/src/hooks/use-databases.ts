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

export interface DatabaseMetrics {
  supported: boolean;
  reason?: string;
  connections?: number;
  sizeBytes?: number;
  storageLimitBytes?: number;
  storagePct?: number;
}

export function useDatabaseMetrics(databaseId: string | null) {
  return useQuery({
    queryKey: ["database-metrics", databaseId],
    queryFn: () => api.get<DatabaseMetrics>(`/databases/${databaseId}/metrics`),
    enabled: !!databaseId,
    refetchInterval: 10_000,
  });
}

export interface DatabaseConnectionSession {
  pid: number;
  username: string;
  clientAddr: string | null;
  state: string;
  query: string;
  queryStart: string | null;
  connectedAt: string;
}

export function useDatabaseConnections(databaseId: string | null) {
  return useQuery({
    queryKey: ["database-connections", databaseId],
    queryFn: () => api.get<{ supported: boolean; reason?: string; connections?: DatabaseConnectionSession[] }>(`/databases/${databaseId}/connections`),
    enabled: !!databaseId,
    refetchInterval: 5_000,
  });
}

export interface DatabaseUser {
  id: string;
  databaseId: string;
  username: string;
  role: string;
  createdAt: string;
}

export function useDatabaseUsers(databaseId: string | null) {
  return useQuery({
    queryKey: ["database-users", databaseId],
    queryFn: () => api.get<DatabaseUser[]>(`/databases/${databaseId}/users`),
    enabled: !!databaseId,
  });
}

export function useCreateDatabaseUser(databaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { username: string; role: "readonly" | "readwrite" }) =>
      api.post<DatabaseUser & { password: string }>(`/databases/${databaseId}/users`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["database-users", databaseId] });
      toast({ title: "Database user created", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Could not create user", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useDeleteDatabaseUser(databaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (databaseUserId: string) => api.delete(`/databases/${databaseId}/users/${databaseUserId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["database-users", databaseId] });
      toast({ title: "Database user removed" });
    },
  });
}
