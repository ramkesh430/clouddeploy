import { RequireAuth } from "@/components/auth/require-auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopNav } from "@/components/dashboard/topnav";

// Everything under here is authenticated, client-fetched data behind
// RequireAuth — there's nothing meaningful to statically prerender, and the
// zustand persist store (browser-only) can't be evaluated at build time.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav />
          <main className="flex-1 overflow-y-auto bg-muted/20 p-6">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
