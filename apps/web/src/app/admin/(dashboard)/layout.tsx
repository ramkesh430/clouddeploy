"use client";

import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminSearch } from "@/components/admin/admin-search";
import { AccessDenied } from "@/components/admin/access-denied";
import { useAuthStore } from "@/lib/store/auth-store";
import { useAdminResource } from "@/hooks/use-phase3";

interface RiskEvent { status: string }

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth redirectTo="/admin/login">
      <AdminGate>{children}</AdminGate>
    </RequireAuth>
  );
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isPlatformAdmin = !!user?.isPlatformAdmin;

  // A real, live count — every OPEN risk event needing human review — not a
  // decorative dot. Same query the abuse page itself uses, so the two never
  // disagree. Gated on isPlatformAdmin so a signed-in non-admin never fires
  // an admin-only request that's guaranteed to 403.
  const { data: riskEvents } = useAdminResource<RiskEvent[]>("/admin/abuse/risk-events?status=OPEN", { enabled: isPlatformAdmin });
  const openCount = riskEvents?.length ?? 0;

  if (!isPlatformAdmin) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-[#07121a] text-slate-200">
      <div className="flex min-h-screen">
        <AdminSidebar />

        <main className="min-w-0 flex-1 lg:ml-[216px]">
          {!user?.twoFactorEnabled && (
            <div className="flex items-center justify-center gap-3 bg-amber-500/15 px-6 py-2 text-center text-xs text-amber-300">
              Two-factor authentication is required to create, edit, or delete anything in the admin panel.
              <Link href="/security" className="font-semibold underline underline-offset-2 hover:text-amber-200">
                Set it up now
              </Link>
            </div>
          )}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#20313e] bg-[#07121a]/95 px-4 backdrop-blur xl:px-5">
            <AdminSearch />

            <div className="ml-auto flex items-center gap-3">
              <Link href="/admin/abuse" className="relative flex h-8 w-8 items-center justify-center rounded-md border border-[#20313e] bg-[#101e28]">
                <Bell className="h-4 w-4" />
                {openCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                    {openCount > 99 ? "99+" : openCount}
                  </span>
                )}
              </Link>

              <Link href="/admin/security" className="flex h-8 w-8 items-center justify-center rounded-md border border-[#20313e] bg-[#101e28]">
                <Settings className="h-4 w-4" />
              </Link>

              <div className="ml-2 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 font-semibold">
                  {(user?.fullName ?? "A").slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-white">{user?.fullName ?? "Admin User"}</p>
                  <p className="text-xs text-slate-500">Super Admin</p>
                </div>
              </div>
            </div>
          </header>

          <div className="p-4 xl:p-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
