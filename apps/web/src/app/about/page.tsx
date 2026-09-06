import type { Metadata } from "next";
import { Layers3, ShieldCheck, Zap } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { CTA } from "@/components/marketing/cta";

export const metadata: Metadata = {
  title: "About — CloudDeploy",
  description: "Why CloudDeploy exists: one platform for a project's entire stack, instead of stitching together a hosting provider, a database, storage, and DNS separately.",
  alternates: { canonical: "/about" },
};

const principles = [
  {
    icon: Zap,
    title: "The whole stack, not just the frontend",
    desc: "Most hosting platforms deploy your frontend and leave the database, storage, and domains to separate providers. CloudDeploy treats a project as one unit: code, data, and infrastructure together.",
  },
  {
    icon: Layers3,
    title: "Real infrastructure underneath",
    desc: "Builds run in real containers on real servers, coordinated across regions — not a simulation of a hosting platform, but the genuine mechanics of one.",
  },
  {
    icon: ShieldCheck,
    title: "Built for teams that will grow",
    desc: "Role-based access, an audit trail, and abuse detection are part of the platform from the start, not a later add-on once a team gets big enough to need them.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="container flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-xs font-bold tracking-[0.15em] text-primary">ABOUT</p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">One platform for the whole stack</h1>
          <p className="max-w-xl text-sidebar-foreground/80">
            CloudDeploy exists so shipping a full application doesn&apos;t mean managing five different vendors to do it.
          </p>
        </div>
      </section>

      <section className="container max-w-3xl py-16">
        <div className="flex flex-col gap-8">
          {principles.map((principle) => (
            <div key={principle.title} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <principle.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{principle.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{principle.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CTA title="Ready to start building?" />
      <MarketingFooter />
    </div>
  );
}
