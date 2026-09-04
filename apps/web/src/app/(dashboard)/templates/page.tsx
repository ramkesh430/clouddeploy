import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates Marketplace</h1>
        <p className="text-sm text-muted-foreground">One-click starters: Next.js, MERN, Laravel + MySQL, Strapi, Ghost, and more.</p>
      </div>
      <ComingSoon
        title="Templates Marketplace"
        description="One-click template deploys are part of Phase 3, once the AI assistant and multi-service deploy orchestration are in place."
        phase="Phase 3"
      />
    </div>
  );
}
