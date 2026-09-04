"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface CreateServiceInput {
  projectId: string;
  name: string;
  type: string;
  runtime?: string;
  framework?: string;
  rootDirectory?: string;
  branch?: string;
  buildCommand?: string;
  startCommand?: string;
  port?: number;
  resourcePreset?: "nano" | "starter" | "developer" | "pro";
}

export function useServices(projectId: string | null) {
  return useQuery({
    queryKey: ["services", projectId],
    queryFn: () => api.get(`/services?projectId=${projectId}`),
    enabled: !!projectId,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServiceInput) => api.post("/services", input),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["services", vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
    onError: (err) => {
      toast({ title: "Could not add service", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useRestartService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) => api.post(`/services/${serviceId}/restart`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "Service restarted", variant: "success" });
    },
  });
}
