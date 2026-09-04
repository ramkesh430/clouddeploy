"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface CronJob {
  id: string;
  name: string;
  command: string;
  cronExpression: string;
  timezone: string;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export function useCronJobs(projectId: string | null) {
  return useQuery({
    queryKey: ["cron-jobs", projectId],
    queryFn: () => api.get<CronJob[]>(`/cron-jobs?projectId=${projectId}`),
    enabled: !!projectId,
    refetchInterval: 15_000,
  });
}

export function useCronJobDetail(cronJobId: string | null) {
  return useQuery({
    queryKey: ["cron-job", cronJobId],
    queryFn: () => api.get<any>(`/cron-jobs/${cronJobId}`),
    enabled: !!cronJobId,
    refetchInterval: 5_000,
  });
}

export function useCreateCronJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; name: string; command: string; cronExpression: string; timezone?: string }) =>
      api.post<CronJob>("/cron-jobs", input),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["cron-jobs", vars.projectId] });
      toast({ title: "Cron job created", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Could not create cron job", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useCronJobAction(action: "pause" | "resume" | "trigger") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cronJobId: string) => api.post(`/cron-jobs/${cronJobId}/${action}`),
    onSuccess: (_d, cronJobId) => {
      queryClient.invalidateQueries({ queryKey: ["cron-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["cron-job", cronJobId] });
      toast({ title: action === "trigger" ? "Run triggered" : `Job ${action}d`, variant: "success" });
    },
  });
}

export function useDeleteCronJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cronJobId: string) => api.delete(`/cron-jobs/${cronJobId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cron-jobs"] });
      toast({ title: "Cron job deleted" });
    },
  });
}
