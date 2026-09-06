import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice } from "@/components/legal/draft-notice";

export const metadata: Metadata = {
  title: "Terms of Service — CloudDeploy",
  description: "The terms that govern your use of CloudDeploy.",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

const sections = [
  {
    title: "1. Acceptance of terms",
    body: "By creating an account or using [Company Legal Name]'s CloudDeploy service (the \"Service\"), you agree to these Terms of Service. If you're accepting on behalf of an organization, you represent that you have the authority to bind that organization.",
  },
  {
    title: "2. Description of the service",
    body: "CloudDeploy hosts, builds, and deploys applications and their associated databases, storage, and infrastructure on your behalf. We may add, change, or remove features at any time.",
  },
  {
    title: "3. Accounts and eligibility",
    body: "You must provide accurate registration information and are responsible for activity under your account and API keys. You must be at least [minimum age] years old to use the Service.",
  },
  {
    title: "4. Acceptable use",
    body: "You may not use the Service to host malware, run cryptocurrency mining, launch attacks against other systems, send spam, or violate applicable law. We may suspend or terminate workloads that violate this section — see our abuse-handling process for how that review works.",
  },
  {
    title: "5. Payment and billing",
    body: "Paid plans are billed in advance on a [monthly/annual] basis through our payment processor. Fees are non-refundable except as required by law or stated otherwise in a specific plan's terms. [Describe trial, proration, and downgrade/cancellation policy.]",
  },
  {
    title: "6. Your content and data",
    body: "You retain ownership of the code, data, and content you deploy through the Service. You grant us the limited right to store, process, and transmit it solely to provide the Service to you. See our Privacy Policy for how we handle personal data.",
  },
  {
    title: "7. Intellectual property",
    body: "The Service, including its software, branding, and documentation, is owned by [Company Legal Name] and protected by intellectual property law. These Terms don't grant you any rights to our trademarks or branding.",
  },
  {
    title: "8. Termination",
    body: "You may stop using the Service and delete your account at any time. We may suspend or terminate your account for violation of these Terms, non-payment, or [other grounds]. Section 4 (abuse) may result in immediate suspension pending review.",
  },
  {
    title: "9. Disclaimers and limitation of liability",
    body: "The Service is provided \"as is\" without warranties of any kind. To the maximum extent permitted by law, [Company Legal Name] is not liable for indirect, incidental, or consequential damages, and our total liability is capped at [amount / fees paid in the preceding N months].",
  },
  {
    title: "10. Governing law",
    body: "These Terms are governed by the laws of [Governing State/Country], without regard to conflict-of-law principles. [Describe dispute resolution / arbitration process if applicable.]",
  },
  {
    title: "11. Changes to these terms",
    body: "We may update these Terms from time to time. We'll notify you of material changes by [email / in-app notice] at least [N] days before they take effect.",
  },
  {
    title: "12. Contact",
    body: "Questions about these Terms can be sent to [legal@yourcompany.example].",
  },
];

export default function TermsPage() {
  return (
    <div className="container max-w-2xl py-16">
      <Link href="/" className="text-sm text-primary hover:underline">← Back to CloudDeploy</Link>
      <h1 className="mt-4 text-2xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Draft — last updated [Effective Date]</p>
      <DraftNotice />
      <div className="mt-8 flex flex-col gap-6">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-base font-semibold">{s.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
