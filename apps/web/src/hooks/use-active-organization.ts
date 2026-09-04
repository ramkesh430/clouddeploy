"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { useOrganizations } from "./use-organizations";

/** Resolves the active organization, falling back to the user's first workspace. */
export function useActiveOrganization() {
  const { data: organizations, isLoading } = useOrganizations();
  const activeOrganizationId = useAuthStore((s) => s.activeOrganizationId);
  const setActiveOrganization = useAuthStore((s) => s.setActiveOrganization);

  useEffect(() => {
    if (!activeOrganizationId && organizations && organizations.length > 0) {
      setActiveOrganization(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganization]);

  const active = organizations?.find((o) => o.id === activeOrganizationId) ?? organizations?.[0] ?? null;

  return { organizations: organizations ?? [], active, isLoading };
}
