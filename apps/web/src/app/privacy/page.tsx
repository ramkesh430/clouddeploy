import Link from "next/link";
import { DraftNotice } from "@/components/legal/draft-notice";

const sections = [
  {
    title: "1. Information we collect",
    body: "Account information (name, email, password hash), billing information (handled by our payment processor — we don't store full card numbers), the code and content you deploy, and operational data such as logs, usage metrics, and IP addresses.",
  },
  {
    title: "2. How we use it",
    body: "To provide and operate the Service, process payments, respond to support requests, detect and prevent abuse (see our acceptable-use policy), and — only with your consent or as permitted by law — for product communications.",
  },
  {
    title: "3. How we share it",
    body: "We share data with subprocessors who help us run the Service (e.g. cloud infrastructure, payment processing, email delivery) under contracts that limit their use of it, and with law enforcement when legally required. We do not sell your personal data.",
  },
  {
    title: "4. Data retention",
    body: "We retain account and billing data for as long as your account is active plus [N years] for legal/tax purposes. Deployment logs are retained for [N days]. You can request deletion of your data as described in Section 6.",
  },
  {
    title: "5. Security",
    body: "We encrypt secrets and credentials at rest, encrypt traffic in transit, and restrict internal access to production data. No system is perfectly secure; see our security page for how to report a vulnerability.",
  },
  {
    title: "6. Your rights",
    body: "Depending on your jurisdiction, you may have the right to access, correct, export, or delete your personal data, and to object to certain processing. Contact [privacy@yourcompany.example] to exercise these rights.",
  },
  {
    title: "7. Cookies",
    body: "We use cookies and similar technologies for authentication (session cookies) and, if enabled, product analytics. [Describe your analytics/cookie-consent approach here.]",
  },
  {
    title: "8. Children's privacy",
    body: "The Service is not directed at children under [13/16], and we don't knowingly collect personal data from them.",
  },
  {
    title: "9. International data transfers",
    body: "Your data may be processed in countries other than your own. [Describe transfer mechanism — e.g. Standard Contractual Clauses — if you operate internationally.]",
  },
  {
    title: "10. Changes to this policy",
    body: "We'll notify you of material changes by [email / in-app notice] before they take effect.",
  },
  {
    title: "11. Contact",
    body: "Questions about this policy, or data requests, can be sent to [privacy@yourcompany.example].",
  },
];

export default function PrivacyPage() {
  return (
    <div className="container max-w-2xl py-16">
      <Link href="/" className="text-sm text-primary hover:underline">← Back to CloudDeploy</Link>
      <h1 className="mt-4 text-2xl font-semibold">Privacy Policy</h1>
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
