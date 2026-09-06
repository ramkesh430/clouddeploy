"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/product", label: "Product" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export function MarketingHeader() {
  const pathname = usePathname();

  return (
    <header className="relative z-20 border-b border-white/10 bg-sidebar text-sidebar-foreground">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold text-white">CloudDeploy</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "border-b-2 border-transparent py-6 text-sidebar-foreground/80 transition-colors hover:text-white",
                pathname === link.href && "border-primary text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="hidden text-sm text-sidebar-foreground/80 hover:text-white sm:inline">
            Login
          </Link>
          <Button size="sm" asChild>
            <Link href="/register">Start Free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
