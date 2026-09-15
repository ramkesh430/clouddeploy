"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface UsageSummary {
  plan: string;
  limits: {
    maxProjects: number;
    maxRamMb: number;
    maxDatabases: number;
    maxTeamMembers: number;
    maxStorageGb: number;
    maxBuildMinutes: number;
    maxBandwidthGb: number;
  };
  usage: {
    projects: number;
    ramMb: number;
    databases: number;
    teamMembers: number;
    storageGb: number;
    buildMinutes: number;
    bandwidthGb: number;
  };
}

export function useUsageSummary(organizationId: string | null) {
  return useQuery({
    queryKey: ["usage", organizationId],
    queryFn: () => api.get<UsageSummary>(`/usage?organizationId=${organizationId}`),
    enabled: !!organizationId,
  });
}
