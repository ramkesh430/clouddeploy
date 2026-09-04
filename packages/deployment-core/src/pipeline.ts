/**
 * The canonical deployment pipeline (section 25/26 of the product spec).
 * Both the real build-worker/runtime-agent (Docker + Traefik) and the local
 * simulation adapter used until those are wired up walk through these same
 * named steps, so the progress stepper and live terminal behave identically
 * regardless of which adapter is executing underneath.
 */
export interface PipelineStep {
  key: string;
  label: string;
  logLines: string[];
  /** Cumulative progress percentage once this step completes. */
  progressAt: number;
}

export const DEPLOYMENT_PIPELINE: PipelineStep[] = [
  { key: "clone", label: "Clone Repository", logLines: ["Cloning repository...", "Repository cloned successfully"], progressAt: 8 },
  { key: "analyze", label: "Analyze Repository", logLines: ["Analyzing repository structure..."], progressAt: 16 },
  { key: "install", label: "Install Dependencies", logLines: ["Installing dependencies..."], progressAt: 30 },
  { key: "build_frontend", label: "Build Frontend", logLines: ["Building frontend..."], progressAt: 42 },
  { key: "build_backend", label: "Build Backend", logLines: ["Building backend..."], progressAt: 54 },
  { key: "docker_image", label: "Create Docker Image", logLines: ["Creating Docker image...", "Pushing image to registry..."], progressAt: 64 },
  { key: "database", label: "Create Database", logLines: ["Provisioning database..."], progressAt: 72 },
  { key: "environment", label: "Configure Environment", logLines: ["Injecting environment variables and secrets..."], progressAt: 78 },
  { key: "containers", label: "Start Containers", logLines: ["Creating private network...", "Starting containers..."], progressAt: 86 },
  { key: "domain", label: "Configure Domain", logLines: ["Configuring Traefik routes..."], progressAt: 91 },
  { key: "ssl", label: "Issue SSL", logLines: ["Issuing SSL certificate..."], progressAt: 95 },
  { key: "health_check", label: "Health Check", logLines: ["Running health check..."], progressAt: 98 },
  { key: "live", label: "Deploy Live", logLines: ["Health check passed", "Deployment successful"], progressAt: 100 },
];

export function detectionSummaryLogLines(frontendDetected: boolean, backendDetected: boolean): string[] {
  const lines: string[] = [];
  if (frontendDetected) lines.push("Detected Next.js frontend");
  if (backendDetected) lines.push("Detected NestJS backend");
  return lines;
}
