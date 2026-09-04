"use client";

import Link from "next/link";
import { Search, Bell, BookOpen, Plus, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAuthStore } from "@/lib/store/auth-store";
import { useUnreadCount } from "@/hooks/use-notifications";

export function TopNav() {
  const { organizations, active } = useActiveOrganization();
  const setActiveOrganization = useAuthStore((s) => s.setActiveOrganization);
  const { data: unreadCount } = useUnreadCount();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {active?.name ?? "Select workspace"}
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organizations.map((org) => (
              <DropdownMenuItem key={org.id} onClick={() => setActiveOrganization(org.id)}>
                <span className="flex-1">{org.name}</span>
                {org.id === active?.id && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button className="flex w-72 items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent">
          <Search className="h-3.5 w-3.5" />
          Search projects, deployments...
          <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/docs" aria-label="Documentation">
            <BookOpen className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild className="relative">
          <Link href="/notifications" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            {!!unreadCount && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/projects/new">
            <Plus className="h-4 w-4" /> Create Project
          </Link>
        </Button>
      </div>
    </header>
  );
}
