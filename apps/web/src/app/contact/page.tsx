import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact — CloudDeploy",
  description: "Get in touch with CloudDeploy for sales, support, or general questions.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="container flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-xs font-bold tracking-[0.15em] text-primary">CONTACT</p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Get in touch</h1>
          <p className="max-w-lg text-sidebar-foreground/80">Sales, support, or just a question — pick a topic and we&apos;ll get it to the right place.</p>
        </div>
      </section>

      <section className="container py-16">
        <Suspense fallback={null}>
          <ContactForm />
        </Suspense>
      </section>
      <MarketingFooter />
    </div>
  );
}
