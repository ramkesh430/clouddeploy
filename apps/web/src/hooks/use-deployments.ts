"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface Deployment {
  id: string;
  projectId: string;
  serviceId: string | null;
  environment: string;
  status: string;
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  progressPct: number;
  currentStep: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  isAutoDeploy?: boolean;
  triggeredBy?: { id: string; fullName: string; email: string; avatarUrl: string | null } | null;
  build?: { dockerImageTag: string | null; status: string } | null;
}

export function useDeployments(projectId: string | null) {
  return useQuery({
    queryKey: ["deployments", projectId],
    queryFn: () => api.get<Deployment[]>(`/deployments?projectId=${projectId}`),
    enabled: !!projectId,
    refetchInterval: 8_000,
  });
}

export function useDeployment(deploymentId: string | null) {
  return useQuery({
    queryKey: ["deployment", deploymentId],
    queryFn: () => api.get(`/deployments/${deploymentId}`),
    enabled: !!deploymentId,
  });
}

export function useCreateDeployment() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { projectId: string; serviceId?: string; branch?: string; environment?: "PRODUCTION" | "PREVIEW" }) =>
      api.post<Deployment>("/deployments", input),
    onSuccess: (deployment) => {
      queryClient.invalidateQueries({ queryKey: ["deployments", deployment.projectId] });
      toast({ title: "Deployment started", description: "Watch it go live in real time.", variant: "success" });
      router.push(`/projects/${deployment.projectId}/deployments/${deployment.id}`);
    },
    onError: (err) => {
      toast({ title: "Could not start deployment", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useRedeploy() {
  const router = useRouter();
  return useMutation({
    mutationFn: (deploymentId: string) => api.post<Deployment>(`/deployments/${deploymentId}/redeploy`),
    onSuccess: (deployment) => {
      toast({ title: "Redeploying", variant: "success" });
      router.push(`/projects/${deployment.projectId}/deployments/${deployment.id}`);
    },
  });
}

export function useRollback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { deploymentId: string; targetDeploymentId: string }) =>
      api.post<Deployment>(`/deployments/${input.deploymentId}/rollback`, { targetDeploymentId: input.targetDeploymentId }),
    onSuccess: (deployment) => {
      queryClient.invalidateQueries({ queryKey: ["deployments", deployment.projectId] });
      toast({ title: "Rolling back to previous healthy deployment", variant: "success" });
    },
  });
}
