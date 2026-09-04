"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/store/toast-store";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  isAgency: boolean;
  _count?: { projects: number; members: number };
}

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: () => api.get<Organization[]>("/organizations"),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; slug: string }) => api.post<Organization>("/organizations", input),
    onSuccess: (org) => {
      useAuthStore.getState().setActiveOrganization(org.id);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (err) => {
      toast({ title: "Could not create workspace", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useOrganizationMembers(organizationId: string | null) {
  return useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: () => api.get(`/organizations/${organizationId}/members`),
    enabled: !!organizationId,
  });
}
