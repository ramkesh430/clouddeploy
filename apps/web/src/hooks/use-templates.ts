"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface TemplateCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Template {
  id: string;
  categoryId: string;
  category: TemplateCategory;
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  repositoryUrl: string | null;
  servicesJson: {
    service?: { name: string; dockerImage?: string; port: number; healthCheckPath?: string };
    services?: Array<{ name: string; dockerImage?: string; port: number; healthCheckPath?: string }>;
    needsDatabase?: boolean;
    needsRedis?: boolean;
    resourcePreset?: string;
  };
  requiredEnvVars: string[];
  estimatedMonthlyUsd: number;
  isFeatured: boolean;
  createdAt: string;
}

export function useTemplateCategories() {
  return useQuery({
    queryKey: ["template-categories"],
    queryFn: () => api.get<TemplateCategory[]>("/templates/categories"),
  });
}

export function useTemplates(organizationId?: string | null) {
  return useQuery({
    queryKey: ["templates", organizationId],
    queryFn: () => api.get<Template[]>(`/templates${organizationId ? `?organizationId=${organizationId}` : ""}`),
  });
}

export function useTemplate(templateId: string | null) {
  return useQuery({
    queryKey: ["template", templateId],
    queryFn: () => api.get<Template>(`/templates/${templateId}`),
    enabled: !!templateId,
  });
}

export interface DeployTemplateResult {
  project: { id: string; slug: string };
  service: { id: string };
  deployment: { id: string };
}

export function useDeployTemplate(templateId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationId: string; projectName: string; projectSlug?: string; region?: string }) =>
      api.post<DeployTemplateResult>(`/templates/${templateId}/deploy`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["databases"] });
      toast({ title: "Deploying template", description: "Your project is being created and deployed.", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Could not deploy template", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}
