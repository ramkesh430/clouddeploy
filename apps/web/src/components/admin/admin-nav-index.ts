import {
  Bell,
  Boxes,
  Building2,
  CircleDollarSign,
  Database,
  Gauge,
  HardDrive,
  LifeBuoy,
  Monitor,
  Network,
  Package,
  Server,
  ShieldAlert,
  ShieldCheck,
  Users,
  WalletCards,
  Webhook,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

// Every href below routes to a real, working admin page — either a
// dedicated one (users, abuse, servers, ...) or the generic
// /admin/[resource] table, never a placeholder.
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    title: "PLATFORM",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Organizations", href: "/admin/organizations", icon: Building2 },
      { label: "Projects", href: "/admin/projects", icon: Package },
      { label: "Deployments", href: "/admin/deployments", icon: Workflow },
      { label: "Services", href: "/admin/services", icon: Boxes },
      { label: "Databases", href: "/admin/databases", icon: Database },
      { label: "Storage", href: "/admin/storage", icon: HardDrive },
      { label: "Domains", href: "/admin/domains", icon: Network },
    ],
  },
  {
    title: "INFRASTRUCTURE",
    items: [
      { label: "Servers", href: "/admin/servers", icon: Server },
      { label: "Build Workers", href: "/admin/build-workers", icon: Wrench },
      { label: "Runtime Nodes", href: "/admin/runtime-nodes", icon: Monitor },
      { label: "Database Nodes", href: "/admin/database-nodes", icon: Database },
      { label: "Capacity", href: "/admin/infrastructure", icon: Gauge },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      { label: "Plans", href: "/admin/plans", icon: WalletCards },
      { label: "Subscriptions", href: "/admin/subscriptions", icon: CircleDollarSign },
      { label: "Transactions", href: "/admin/transactions", icon: Gauge },
      { label: "Usage", href: "/admin/usage", icon: Gauge },
    ],
  },
  {
    title: "SUPPORT",
    items: [
      { label: "Support Tickets", href: "/admin/support", icon: LifeBuoy },
      { label: "Abuse Reports", href: "/admin/abuse", icon: ShieldAlert },
      { label: "Alert Rules", href: "/admin/alert-rules", icon: Bell },
      { label: "Webhooks", href: "/admin/webhooks", icon: Webhook },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Security", href: "/admin/security", icon: ShieldCheck },
      { label: "Audit Logs", href: "/admin/system-logs", icon: ShieldCheck },
    ],
  },
];

export const ADMIN_SEARCH_INDEX: { label: string; href: string; section: string }[] = ADMIN_NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ label: item.label, href: item.href, section: section.title })),
);
