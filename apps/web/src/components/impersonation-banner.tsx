"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";

/** A persistent, impossible-to-miss strip shown across the entire app —
 * not just /admin — whenever a platform admin is viewing as another user,
 * so it's never ambiguous whose account is currently active. */
export function ImpersonationBanner() {
  const router = useRouter();
  const impersonator = useAuthStore((s) => s.impersonator);
  const user = useAuthStore((s) => s.user);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);

  if (!impersonator) return null;

  function returnToAdmin() {
    stopImpersonation();
    router.replace("/admin/users");
  }

  return (
    <div className="sticky top-0 z-[100] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        Viewing as {user?.fullName ?? user?.email} ({user?.email}) — signed in as {impersonator.user.email}
      </span>
      <button onClick={returnToAdmin} className="rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900">
        Return to admin
      </button>
    </div>
  );
}
