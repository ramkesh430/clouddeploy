"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";
import type { RepositoryDetectionResult } from "@clouddeploy/types";

export interface GithubConnection {
  id: string;
  providerLogin: string;
  createdAt: string;
}

export interface GithubRepo {
  fullName: string;
  owner: string;
  name: string;
  isPrivate: boolean;
  language: string | null;
  defaultBranch: string;
  updatedAt: string;
}

export function useGithubConnections(organizationId: string | null) {
  return useQuery({
    queryKey: ["github-connections", organizationId],
    queryFn: () => api.get<GithubConnection[]>(`/github/connections?organizationId=${organizationId}`),
    enabled: !!organizationId,
  });
}

export function useConnectGithub() {
  return useMutation({
    mutationFn: (organizationId: string) => api.get<{ url: string }>(`/github/connect?organizationId=${organizationId}`),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast({
        title: "GitHub connection unavailable",
        description: err instanceof ApiError ? err.message : "Try again later",
        variant: "destructive",
      });
    },
  });
}

export function useGithubRepositories(connectionId: string | null) {
  return useQuery({
    queryKey: ["github-repositories", connectionId],
    queryFn: () => api.get<GithubRepo[]>(`/github/repositories?connectionId=${connectionId}`),
    enabled: !!connectionId,
  });
}

export function useDetectStack() {
  return useMutation({
    mutationFn: (input: { connectionId: string; owner: string; repo: string; branch?: string }) =>
      api.get<RepositoryDetectionResult>(
        `/github/detect?connectionId=${input.connectionId}&owner=${input.owner}&repo=${input.repo}${input.branch ? `&branch=${input.branch}` : ""}`,
      ),
    onError: (err) => {
      toast({ title: "Detection failed", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function usePublicDetectStack() {
  return useMutation({
    mutationFn: (input: { owner: string; repo: string; branch?: string }) =>
      api.get<RepositoryDetectionResult>(
        `/github/public-detect?owner=${input.owner}&repo=${input.repo}${input.branch ? `&branch=${input.branch}` : ""}`,
        { skipAuth: true },
      ),
    onError: (err) => {
      toast({
        title: "Could not detect this repository",
        description: err instanceof ApiError ? err.message : "Make sure it's a public repository",
        variant: "destructive",
      });
    },
  });
}

export function useImportRepository() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; connectionId: string; fullName: string; branch?: string }) =>
      api.post("/github/import", input),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
  });
}
