"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/lib/store/auth-store";
import { toast } from "@/lib/store/toast-store";

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}

/** The cached user in the persisted auth store is only ever written at
 * login — if the server-side shape of that user object gains a field
 * (as isPlatformAdmin and twoFactorEnabled did mid-project), anyone who
 * stayed logged in across that change keeps a stale snapshot missing it
 * forever, with no way to notice. Mounted once app-wide, this pulls the
 * server's current view of whichever identity is active (including a
 * currently-impersonated one) and reconciles the cache — so a security
 * flag the server already knows about doesn't silently go stale on the
 * client. */
export function useSyncCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const { data } = useQuery({
    queryKey: ["auth-me-sync"],
    queryFn: () => api.get<AuthUser>("/auth/me"),
    enabled: !!accessToken,
    refetchOnMount: true,
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    setUser({
      id: data.id,
      email: data.email,
      fullName: data.fullName,
      avatarUrl: data.avatarUrl,
      emailVerified: data.emailVerified,
      isPlatformAdmin: data.isPlatformAdmin,
      twoFactorEnabled: data.twoFactorEnabled,
    });
  }, [data, setUser]);
}

async function routeAfterAuth(router: ReturnType<typeof useRouter>) {
  try {
    const orgs = await api.get<Array<{ id: string; slug: string }>>("/organizations");
    if (orgs.length === 0) {
      router.push("/onboarding");
    } else {
      useAuthStore.getState().setActiveOrganization(orgs[0].id);
      router.push("/dashboard");
    }
  } catch {
    router.push("/onboarding");
  }
}

export function useLogin() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { email: string; password: string; otpCode?: string }) => api.post<AuthResponse>("/auth/login", input),
    onSuccess: async (data) => {
      useAuthStore.getState().setSession(data.user, data.accessToken);
      toast({ title: "Welcome back", description: `Signed in as ${data.user.email}`, variant: "success" });
      await routeAfterAuth(router);
    },
    onError: (err) => {
      // "Two-factor code required"/"Invalid two-factor code" are handled
      // inline by the login form (it reveals the code field and resubmits)
      // rather than as a toast — every other login failure still toasts.
      if (err instanceof ApiError && err.message.toLowerCase().includes("two-factor")) return;
      toast({ title: "Login failed", description: err instanceof ApiError ? err.message : "Something went wrong", variant: "destructive" });
    },
  });
}

export function useRegister() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { fullName: string; email: string; password: string }) =>
      api.post<AuthResponse>("/auth/register", input),
    onSuccess: async (data) => {
      useAuthStore.getState().setSession(data.user, data.accessToken);
      toast({ title: "Account created", description: "Let's set up your workspace.", variant: "success" });
      router.push("/onboarding");
    },
    onError: (err) => {
      toast({ title: "Sign up failed", description: err instanceof ApiError ? err.message : "Something went wrong", variant: "destructive" });
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post("/auth/forgot-password", { email }),
    onSuccess: () => toast({ title: "Check your inbox", description: "If that email exists, a reset link is on its way." }),
  });
}

export function useResetPassword() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { token: string; newPassword: string }) => api.post("/auth/reset-password", input),
    onSuccess: () => {
      toast({ title: "Password reset", description: "You can now log in with your new password.", variant: "success" });
      router.push("/login");
    },
    onError: (err) => {
      toast({ title: "Reset failed", description: err instanceof ApiError ? err.message : "This link may have expired.", variant: "destructive" });
    },
  });
}

export function useExportData() {
  return useMutation({
    mutationFn: () => api.get<Record<string, unknown>>("/auth/me/export"),
    onError: (err) => toast({ title: "Export failed", description: err instanceof ApiError ? err.message : "Something went wrong", variant: "destructive" }),
  });
}

export function useDeleteAccount() {
  const router = useRouter();
  return useMutation({
    mutationFn: (password: string) => api.delete("/auth/me", { body: { password } }),
    onSuccess: () => {
      useAuthStore.getState().clear();
      toast({ title: "Account deleted", description: "Your account has been permanently deleted." });
      router.push("/login");
    },
    onError: (err) => toast({ title: "Couldn't delete account", description: err instanceof ApiError ? err.message : "Something went wrong", variant: "destructive" }),
  });
}

export function useLogout() {
  const router = useRouter();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled: () => {
      useAuthStore.getState().clear();
      router.push("/login");
    },
  });
}
