import { RequireAuth } from "@/components/auth/require-auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const dynamic = "force-dynamic";
export default function AdminLayout({ children }: { children: React.ReactNode }) { return <RequireAuth><div className="flex min-h-screen"><AdminSidebar /><div className="min-w-0 flex-1"><header className="flex h-16 items-center justify-between border-b px-6"><span className="text-sm font-medium">Platform control plane</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">Super Admin</span></header><main className="bg-muted/20 p-6">{children}</main></div></div></RequireAuth>; }
