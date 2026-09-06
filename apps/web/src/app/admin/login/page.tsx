"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/lib/store/auth-store";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // An already-authenticated platform admin who lands back on this page
  // (bookmark, browser back) should just go straight to the dashboard.
  useEffect(() => {
    if (accessToken && user?.isPlatformAdmin) router.replace("/admin");
  }, [accessToken, user, router]);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setSubmitting(true);
    try {
      const data = await api.post<AuthResponse>("/auth/login", values);
      if (!data.user.isPlatformAdmin) {
        // Deliberately not calling setSession here: this form's only job is
        // admin access, and leaving the browser logged into the customer app
        // via a rejected admin login attempt would be a confusing half-state.
        setFormError("This account does not have platform administrator access.");
        return;
      }
      setSession(data.user, data.accessToken);
      router.replace("/admin");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07101c] px-4 text-slate-200">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">CloudDeploy Admin</h1>
            <p className="text-sm text-slate-500">Platform administrator sign-in</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm text-slate-400">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="admin@clouddeploy.dev"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                {...register("email")}
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm text-slate-400">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                {...register("password")}
              />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {formError && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-600">
          Not an admin?{" "}
          <Link href="/login" className="text-slate-400 hover:text-slate-300 hover:underline">
            Go to customer login
          </Link>
        </p>
      </div>
    </div>
  );
}
