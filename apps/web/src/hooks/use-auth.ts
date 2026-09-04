"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/lib/store/auth-store";
import { toast } from "@/lib/store/toast-store";

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
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
    mutationFn: (input: { email: string; password: string }) => api.post<AuthResponse>("/auth/login", input),
    onSuccess: async (data) => {
      useAuthStore.getState().setSession(data.user, data.accessToken);
      toast({ title: "Welcome back", description: `Signed in as ${data.user.email}`, variant: "success" });
      await routeAfterAuth(router);
    },
    onError: (err) => {
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
