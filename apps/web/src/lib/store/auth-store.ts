import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
  twoFactorEnabled: boolean;
}

interface Impersonator {
  user: AuthUser;
  accessToken: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  activeOrganizationId: string | null;
  /** Set only while a platform admin is viewing the app as another user —
   * holds the admin's own session so "Return to admin" can restore it
   * without a second login. */
  impersonator: Impersonator | null;
  setSession: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setActiveOrganization: (organizationId: string) => void;
  startImpersonation: (targetUser: AuthUser, targetAccessToken: string) => void;
  stopImpersonation: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      activeOrganizationId: null,
      impersonator: null,
      setSession: (user, accessToken) => set({ user, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setActiveOrganization: (organizationId) => set({ activeOrganizationId: organizationId }),
      startImpersonation: (targetUser, targetAccessToken) => {
        const { user, accessToken } = get();
        if (!user || !accessToken) return;
        set({ impersonator: { user, accessToken }, user: targetUser, accessToken: targetAccessToken, activeOrganizationId: null });
      },
      stopImpersonation: () => {
        const { impersonator } = get();
        if (!impersonator) return;
        set({ user: impersonator.user, accessToken: impersonator.accessToken, impersonator: null, activeOrganizationId: null });
      },
      clear: () => set({ user: null, accessToken: null, activeOrganizationId: null, impersonator: null }),
    }),
    { name: "clouddeploy-auth" },
  ),
);
