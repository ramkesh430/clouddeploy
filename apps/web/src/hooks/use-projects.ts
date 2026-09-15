"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  region: string;
  productionUrl: string | null;
  assignedHostname?: string;
  domainStatus?: string;
  domainReady?: boolean;
  domainMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  repository: { fullName: string; defaultBranch: string } | null;
  services: Array<{ id: string; name: string; type: string; framework: string; status: string }>;
  _count: { services: number; deployments: number };
}

export function useProjects(organizationId: string | null) {
  return useQuery({
    queryKey: ["projects", organizationId],
    queryFn: () => api.get<ProjectSummary[]>(`/projects?organizationId=${organizationId}`),
    enabled: !!organizationId,
  });
}

export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.get(`/projects/${projectId}`),
    enabled: !!projectId,
    refetchInterval: 10_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationId: string; name: string; slug: string; description?: string; region?: string }) =>
      api.post<ProjectSummary>("/projects", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      toast({ title: "Could not create project", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useProjectAction(action: "pause" | "resume" | "archive") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.post(`/projects/${projectId}/${action}`),
    onSuccess: (_data, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast({ title: `Project ${action}d`, variant: "success" });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project deleted", variant: "success" });
    },
  });
}
