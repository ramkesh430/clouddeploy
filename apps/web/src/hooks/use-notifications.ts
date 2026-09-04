"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export const NOTIFICATION_TYPES = [
  "DEPLOYMENT_SUCCESSFUL",
  "DEPLOYMENT_FAILED",
  "DATABASE_BACKUP_COMPLETED",
  "DATABASE_BACKUP_FAILED",
  "CPU_HIGH",
  "RAM_HIGH",
  "DISK_ALMOST_FULL",
  "SSL_ERROR",
  "SERVER_DOWN",
  "PAYMENT_FAILED",
  "DOMAIN_VERIFICATION_FAILED",
] as const;

export interface Notification {
  id: string;
  organizationId: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  type: string;
  channel: "IN_APP" | "EMAIL" | "WEBHOOK" | "SLACK" | "DISCORD" | "WHATSAPP";
  enabled: boolean;
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Notification[]>("/notifications"),
    refetchInterval: 15_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => api.get<number>("/notifications/unread-count"),
    refetchInterval: 15_000,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => api.post(`/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.get<NotificationPreference[]>("/notifications/preferences"),
  });
}

export function useSetPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string; channel: string; enabled: boolean }) =>
      api.post<NotificationPreference>("/notifications/preferences", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}
