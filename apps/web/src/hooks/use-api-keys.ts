"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export const API_KEY_PERMISSIONS = [
  "projects:read",
  "projects:write",
  "deployments:read",
  "deployments:write",
  "logs:read",
  "databases:read",
  "databases:write",
  "domains:read",
  "domains:write",
  "billing:read",
] as const;

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  createdAt: string;
  user?: { fullName: string; email: string };
}

export function useApiKeys(organizationId: string | null) {
  return useQuery({
    queryKey: ["api-keys", organizationId],
    queryFn: () => api.get<ApiKey[]>(`/api-keys?organizationId=${organizationId}`),
    enabled: !!organizationId,
  });
}

export function useCreateApiKey(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; permissions: string[] }) =>
      api.post<ApiKey & { key: string }>("/api-keys", { organizationId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", organizationId] });
    },
    onError: (err) => {
      toast({ title: "Could not create API key", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useRevokeApiKey(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKeyId: string) => api.delete(`/api-keys/${apiKeyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", organizationId] });
      toast({ title: "API key revoked" });
    },
  });
}
