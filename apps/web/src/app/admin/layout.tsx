"use client";

import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminSearch } from "@/components/admin/admin-search";
import { useAuthStore } from "@/lib/store/auth-store";
import { useAdminResource } from "@/hooks/use-phase3";

interface RiskEvent { status: string }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  // A real, live count — every OPEN risk event needing human review — not a
  // decorative dot. Same query the abuse page itself uses, so the two never
  // disagree.
  const { data: riskEvents } = useAdminResource<RiskEvent[]>("/admin/abuse/risk-events?status=OPEN");
  const openCount = riskEvents?.length ?? 0;

  return (
    <RequireAuth>
      <div className="min-h-screen bg-[#07101c] text-slate-200">
        <div className="flex min-h-screen">
          <AdminSidebar />

          <main className="min-w-0 flex-1 lg:ml-[260px]">
            <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-800 bg-[#07101c]/95 px-6 backdrop-blur xl:px-8">
              <AdminSearch />

              <div className="ml-auto flex items-center gap-3">
                <Link href="/admin/abuse" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
                  <Bell className="h-4 w-4" />
                  {openCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                      {openCount > 99 ? "99+" : openCount}
                    </span>
                  )}
                </Link>

                <Link href="/admin/security" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
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

            <div className="p-6 xl:p-8">{children}</div>
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
