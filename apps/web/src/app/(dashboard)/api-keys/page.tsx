import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ApiKeysPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
        <p className="text-sm text-muted-foreground">Programmatic access for the CLI and public API.</p>
      </div>
      <ComingSoon
        title="API Keys"
        description="Scoped API key issuance (projects, deployments, logs, databases, domains, billing) lands with the public API in Phase 3."
        phase="Phase 3"
      />
    </div>
  );
}
