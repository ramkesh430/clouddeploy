"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export const WEBHOOK_EVENTS = [
  "deployment.started",
  "deployment.success",
  "deployment.failed",
  "service.restarted",
  "database.backup.completed",
  "database.backup.failed",
  "alert.triggered",
] as const;

export interface Webhook {
  id: string;
  organizationId: string;
  projectId: string | null;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  _count?: { deliveries: number };
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  responseStatus: number | null;
  succeeded: boolean;
  attempt: number;
  createdAt: string;
}

export function useWebhooks(organizationId: string | null) {
  return useQuery({
    queryKey: ["webhooks", organizationId],
    queryFn: () => api.get<Webhook[]>(`/webhooks?organizationId=${organizationId}`),
    enabled: !!organizationId,
  });
}

export function useCreateWebhook(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { url: string; events: string[] }) =>
      api.post<Webhook>("/webhooks", { organizationId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", organizationId] });
      toast({ title: "Webhook created", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Could not create webhook", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useDeleteWebhook(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) => api.delete(`/webhooks/${webhookId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", organizationId] });
      toast({ title: "Webhook deleted" });
    },
  });
}

export function useWebhookDeliveries(webhookId: string | null) {
  return useQuery({
    queryKey: ["webhook-deliveries", webhookId],
    queryFn: () => api.get<WebhookDelivery[]>(`/webhooks/${webhookId}/deliveries`),
    enabled: !!webhookId,
  });
}
