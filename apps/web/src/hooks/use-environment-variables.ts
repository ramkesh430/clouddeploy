"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface EnvVar {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  environment: string;
  serviceId: string | null;
  updatedAt: string;
}

export function useEnvironmentVariables(projectId: string | null) {
  return useQuery({
    queryKey: ["env-vars", projectId],
    queryFn: () => api.get<EnvVar[]>(`/environment-variables?projectId=${projectId}`),
    enabled: !!projectId,
  });
}

export function useRevealEnvVar() {
  return useMutation({
    mutationFn: (envVarId: string) => api.get<{ value: string }>(`/environment-variables/${envVarId}/reveal`),
  });
}

export function useCreateEnvVar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; key: string; value: string; isSecret?: boolean }) =>
      api.post<EnvVar>("/environment-variables", input),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["env-vars", vars.projectId] });
      toast({ title: "Environment variable added", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Could not add variable", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useDeleteEnvVar(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (envVarId: string) => api.delete(`/environment-variables/${envVarId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["env-vars", projectId] });
      toast({ title: "Environment variable deleted" });
    },
  });
}

export function useBulkImportEnvVars() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; raw: string }) => api.post<EnvVar[]>("/environment-variables/bulk-import", input),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["env-vars", vars.projectId] });
      toast({ title: "Environment variables imported", variant: "success" });
    },
  });
}
