"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  LayoutDashboard,
  FolderKanban,
  Rocket,
  Database,
  HardDrive,
  Globe,
  Activity,
  LayoutTemplate,
  Users,
  CreditCard,
  BarChart3,
  Bell,
  KeyRound,
  Settings,
  LogOut,
  Sparkles,
  Building2,
  MapPinned,
  Scale,
  LifeBuoy,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { useLogout } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const platformLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/deployments", label: "Deployments", icon: Rocket },
  { href: "/databases", label: "Databases", icon: Database },
  { href: "/storage", label: "Storage", icon: HardDrive },
  { href: "/domains", label: "Domains", icon: Globe },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/ai", label: "AI Assistant", icon: Sparkles },
  { href: "/agency", label: "Agency", icon: Building2 },
  { href: "/regions", label: "Regions", icon: MapPinned },
  { href: "/autoscaling", label: "Autoscaling", icon: Scale },
];

const accountLinks = [
  { href: "/team", label: "Team", icon: Users },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/usage", label: "Usage", icon: BarChart3 },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const NavLink = ({ href, label, icon: Icon }: (typeof platformLinks)[number]) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          active
            ? "bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-sm"
            : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-white/5 bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/5 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-white">CloudDeploy</span>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-3">
        <div className="flex flex-col gap-1">
          <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Platform</span>
          {platformLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Account</span>
          {accountLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </div>
      </nav>

      <div className="flex items-center gap-2.5 border-t border-white/10 px-4 py-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-sm">
            {(user?.fullName ?? "U").slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-white">{user?.fullName ?? "User"}</p>
          <p className="truncate text-[11px] text-sidebar-foreground/50">{user?.email}</p>
        </div>
        <button
          onClick={() => logout.mutate()}
          className="text-sidebar-foreground/50 hover:text-white"
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
