"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface DashboardSummary {
  stats: {
    totalProjects: number;
    runningServices: number;
    buildingServices: number;
    failedServices: number;
    databases: number;
    storageUsedMb: number;
    monthlyBandwidthGb: number;
    monthlyCostUsd: number;
  };
  recentProjects: Array<{
    id: string;
    name: string;
    slug: string;
    repository: string | null;
    framework: string | null;
    status: string;
    productionUrl: string | null;
    lastDeployAt: string | null;
  }>;
  recentDeployments: Array<{
    id: string;
    project: string;
    projectSlug: string;
    branch: string;
    commitSha: string | null;
    status: string;
    durationMs: number | null;
    createdAt: string;
  }>;
  infrastructureHealth: Record<string, string>;
}

export function useDashboardSummary(organizationId: string | null) {
  return useQuery({
    queryKey: ["dashboard", organizationId],
    queryFn: () => api.get<DashboardSummary>(`/dashboard?organizationId=${organizationId}`),
    enabled: !!organizationId,
    refetchInterval: 15_000,
  });
}
