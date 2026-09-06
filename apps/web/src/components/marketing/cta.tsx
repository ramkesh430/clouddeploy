import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA({ title = "Ready to deploy your next project?" }: { title?: string }) {
  return (
    <section className="container py-10">
      <div className="flex flex-col items-center gap-5 rounded-xl bg-gradient-to-br from-sidebar to-[#0b376e] p-8 text-center text-white sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-4">
          <Rocket className="hidden h-7 w-7 shrink-0 text-primary sm:block" />
          <div>
            <p className="text-lg font-semibold">{title}</p>
            <p className="mt-1 text-sm text-white/70">Join thousands of developers and ship your ideas faster with CloudDeploy.</p>
          </div>
        </div>
        <Button size="lg" className="shrink-0" asChild>
          <Link href="/register">
            Start Free Today <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
