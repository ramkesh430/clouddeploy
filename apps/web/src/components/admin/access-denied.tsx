"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";

/** Shown when a fully authenticated user without `isPlatformAdmin` lands on
 * an /admin route — e.g. a customer following a stale or guessed link.
 * Distinct from the unauthenticated case (handled by RequireAuth redirecting
 * to /admin/login): this account's credentials work, they simply aren't a
 * platform administrator, so bouncing them back to the same login form would
 * only fail again. */
export function AccessDenied() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07121a] px-4 text-slate-200">
      <div className="w-full max-w-md rounded-lg border border-[#20313e] bg-[#101e28] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-red-500/15 text-red-400">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-white">Platform administrator access required</h1>
        <p className="mt-2 text-sm text-slate-400">
          {user?.email ?? "This account"} is signed in but doesn&apos;t have platform administrator privileges. Contact
          a platform admin if you believe this is a mistake.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/dashboard" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Go to your dashboard
          </Link>
          <Link href="/admin/login" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Sign in as a different account
          </Link>
        </div>
      </div>
    </div>
  );
}
