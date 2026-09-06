import type { Metadata } from "next";
import { PricingContent } from "./pricing-content";

export const metadata: Metadata = {
  title: "Pricing — CloudDeploy",
  description: "Simple, transparent pricing for every builder. Start free, no credit card required, and scale up as your projects grow.",
  alternates: { canonical: "/pricing" },
  openGraph: { title: "CloudDeploy Pricing", description: "Simple, transparent pricing for every builder.", url: "/pricing" },
};

export default function PricingPage() {
  return <PricingContent />;
}
