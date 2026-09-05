"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Building2, CircleDollarSign, DatabaseBackup, FolderKanban, Globe2, HardDrive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAgencyDashboard } from "@/hooks/use-phase3";
import { formatBytes, formatCurrency } from "@/lib/utils";

export default function AgencyDashboardPage() {
  const { active } = useActiveOrganization(); const { data } = useAgencyDashboard(active?.id);
  const cards = [
    ["Clients", data?.clients ?? 0, Building2], ["Projects", data?.projects ?? 0, FolderKanban], ["Healthy", data?.healthy ?? 0, Activity], ["Failed", data?.failed ?? 0, AlertTriangle],
    ["Hosting cost", formatCurrency((data?.monthlyHostingCostCents ?? 0) / 100), CircleDollarSign], ["Revenue", formatCurrency((data?.monthlyRevenueCents ?? 0) / 100), CircleDollarSign], ["Storage", formatBytes(Number(data?.storageBytes ?? 0)), HardDrive], ["Expiring domains", data?.expiringDomains ?? 0, Globe2], ["Failed backups", data?.failedBackups ?? 0, DatabaseBackup],
  ] as const;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, Icon]) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></CardContent></Card>)}<Link href="/agency/clients" className="text-sm text-primary hover:underline">Manage clients →</Link></div>;
}
