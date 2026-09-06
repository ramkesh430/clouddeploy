import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardPreview } from "./dashboard-preview";

interface HeroProps {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  benefits?: string[];
}

const defaultBenefits = ["No credit card required", "Deploy in minutes", "Loved by developers"];

export function Hero({
  eyebrow,
  title,
  subtitle,
  primaryLabel = "Start Building Free",
  secondaryLabel = "Watch Product Tour",
  benefits = defaultBenefits,
}: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
      <div className="pointer-events-none absolute -right-40 top-8 h-96 w-96 rounded-full border border-primary/30 bg-primary/10 blur-2xl" />
      <div className="container relative z-10 grid gap-10 py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-bold tracking-[0.15em] text-primary">{eyebrow}</p>
          <h1 className="mt-4 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">{title}</h1>
          <p className="mt-4 max-w-lg text-lg text-sidebar-foreground/80">{subtitle}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/register">
                {primaryLabel} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
              <Link href="/docs">
                <PlayCircle className="h-4 w-4" /> {secondaryLabel}
              </Link>
            </Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-5 text-sm text-sidebar-foreground/80">
            {benefits.map((b) => (
              <span key={b} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" /> {b}
              </span>
            ))}
          </div>
        </div>
        <DashboardPreview />
      </div>
    </section>
  );
}
