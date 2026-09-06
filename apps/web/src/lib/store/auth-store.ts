import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  activeOrganizationId: string | null;
  setSession: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setActiveOrganization: (organizationId: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      activeOrganizationId: null,
      setSession: (user, accessToken) => set({ user, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setActiveOrganization: (organizationId) => set({ activeOrganizationId: organizationId }),
      clear: () => set({ user: null, accessToken: null, activeOrganizationId: null }),
    }),
    { name: "clouddeploy-auth" },
  ),
);
