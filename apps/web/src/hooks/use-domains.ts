"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/store/toast-store";

export interface DomainRecord {
  id: string;
  projectId: string;
  hostname: string;
  type: "PLATFORM" | "CUSTOM";
  status: string;
  dnsStatus: string;
  sslStatus: string;
  ssl?: { status: string; lastError?: string | null } | null;
  lastError?: string | null;
  dnsRecords?: Record<string, { type: string; name: string; value: string; purpose?: string }>;
  target?: string | null;
  assignedUrl: string;
  openUrl: string | null;
  copyRecord?: { type: string; name: string; value: string };
  createdAt: string;
  project?: { id: string; name: string; slug: string };
}

export interface DomainListResponse {
  edge: {
    platformDomain: string;
    publicServerIp: string | null;
    publicEdgeReady: boolean;
    development: boolean;
    dnsProvider: string | null;
    banner: string | null;
    wildcardRecord: { type: string; name: string; value: string };
  };
  data: DomainRecord[];
}

export function useDomains(organizationId: string | null) {
  return useQuery({
    queryKey: ["domains", organizationId],
    queryFn: () => api.get<DomainListResponse>(`/domains?organizationId=${organizationId}`),
    enabled: !!organizationId,
  });
}

export function useCreateDomain(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; hostname: string }) =>
      api.post(`/domains?organizationId=${organizationId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
      toast({ title: "Domain added", description: "Configure the DNS records, then verify.", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Could not add domain", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useVerifyDomain(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) =>
      api.post<{ id: string; status: string; verificationError?: string }>(`/domains/${domainId}/verify`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
      if (data.status === "ACTIVE") {
        toast({ title: "Domain verified", description: "DNS points at this platform. SSL is next.", variant: "success" });
      } else {
        toast({ title: "DNS not verified yet", description: data.verificationError ?? "Records do not match yet", variant: "destructive" });
      }
    },
  });
}

export function useRefreshSsl(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) => api.post(`/domains/${domainId}/ssl/refresh`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
      toast({ title: "SSL refresh requested", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "SSL not issued", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}

export function useRemoveDomain(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) => api.delete(`/domains/${domainId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains", organizationId] });
      toast({ title: "Domain removed", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Could not remove domain", description: err instanceof ApiError ? err.message : "Try again", variant: "destructive" });
    },
  });
}
