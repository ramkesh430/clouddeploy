"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface AlertRule {
  id: string;
  organizationId: string;
  projectId: string | null;
  serviceId: string | null;
  databaseId: string | null;
  metric: string;
  comparator: "GREATER_THAN" | "LESS_THAN";
  threshold: number;
  enabled: boolean;
  lastTriggeredAt: string | null;
  cooldownMinutes: number;
  createdAt: string;
}

export function useAlertRules(organizationId: string | null) {
  return useQuery({
    queryKey: ["alert-rules", organizationId],
    queryFn: () => api.get<AlertRule[]>(`/alerts?organizationId=${organizationId}`),
    enabled: !!organizationId,
    refetchInterval: 15_000,
  });
}

export function useCreateAlertRule(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { databaseId: string; metric: string; comparator: string; threshold: number; cooldownMinutes: number }) =>
      api.post<AlertRule>("/alerts", { organizationId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules", organizationId] });
      toast({ title: "Alert rule created", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Could not create alert rule", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useSetAlertRuleEnabled(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.post(`/alerts/${id}/${enabled ? "enable" : "disable"}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules", organizationId] });
    },
  });
}

export function useDeleteAlertRule(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules", organizationId] });
      toast({ title: "Alert rule deleted" });
    },
  });
}
