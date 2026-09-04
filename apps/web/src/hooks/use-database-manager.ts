"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface TableInfo {
  name: string;
  type: string;
  estimatedRows: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  default: string | null;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

export interface RowsResult extends QueryResult {
  totalRows: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  updatedAt: string;
}

export function useTables(databaseId: string | null, schema = "public") {
  return useQuery({
    queryKey: ["db-tables", databaseId, schema],
    queryFn: () => api.get<TableInfo[]>(`/databases/${databaseId}/tables?schema=${schema}`),
    enabled: !!databaseId,
  });
}

export function useTableColumns(databaseId: string | null, table: string | null, schema = "public") {
  return useQuery({
    queryKey: ["db-columns", databaseId, schema, table],
    queryFn: () => api.get<ColumnInfo[]>(`/databases/${databaseId}/tables/${table}/columns?schema=${schema}`),
    enabled: !!databaseId && !!table,
  });
}

export function useTableRows(databaseId: string | null, table: string | null, page: number, schema = "public") {
  return useQuery({
    queryKey: ["db-rows", databaseId, schema, table, page],
    queryFn: () =>
      api.get<RowsResult>(`/databases/${databaseId}/tables/${table}/rows?schema=${schema}&page=${page}&pageSize=50`),
    enabled: !!databaseId && !!table,
  });
}

export function useRunQuery(databaseId: string) {
  return useMutation({
    mutationFn: (sql: string) => api.post<QueryResult>(`/databases/${databaseId}/query`, { sql }),
    onError: (err) => {
      toast({ title: "Query failed", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useSavedQueries(databaseId: string | null) {
  return useQuery({
    queryKey: ["saved-queries", databaseId],
    queryFn: () => api.get<SavedQuery[]>(`/databases/${databaseId}/saved-queries`),
    enabled: !!databaseId,
  });
}

export function useSaveQuery(databaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; sql: string }) => api.post<SavedQuery>(`/databases/${databaseId}/saved-queries`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-queries", databaseId] });
      toast({ title: "Query saved", variant: "success" });
    },
  });
}

export function useDeleteSavedQuery(databaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (queryId: string) => api.delete(`/databases/${databaseId}/saved-queries/${queryId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-queries", databaseId] }),
  });
}
