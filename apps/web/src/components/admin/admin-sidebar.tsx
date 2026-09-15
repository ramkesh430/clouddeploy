"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cloud, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { ADMIN_NAV_SECTIONS } from "./admin-nav-index";

export function AdminSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[216px] border-r border-[#20313e] bg-[#060f17] lg:flex lg:flex-col">
      <Link href="/admin" className="flex h-14 items-center gap-3 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
          <Cloud className="h-5 w-5 text-white" />
        </div>
        <span className="text-sm font-semibold text-white">CloudDeploy</span>
      </Link>

      <div className="px-3">
        <Link
          href="/admin"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
            pathname === "/admin" ? "bg-blue-600/80 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white",
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-6">
        {ADMIN_NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-slate-600">{section.title}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-xs transition-colors",
                      active ? "bg-blue-600/80 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#20313e] p-4">
        <Link href="/dashboard" className="flex w-full items-center gap-3 rounded-md p-2 hover:bg-slate-800">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 font-semibold text-white">
            {(user?.fullName ?? "A").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-white">{user?.fullName ?? "Admin User"}</p>
            <p className="truncate text-xs text-slate-500">← Customer dashboard</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
