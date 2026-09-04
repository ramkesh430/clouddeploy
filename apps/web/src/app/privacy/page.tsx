import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="container max-w-2xl py-16">
      <Link href="/" className="text-sm text-primary hover:underline">← Back to CloudDeploy</Link>
      <h1 className="mt-4 text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Placeholder privacy policy for development. Replace with legal-reviewed policy before accepting production traffic.
      </p>
    </div>
  );
}
