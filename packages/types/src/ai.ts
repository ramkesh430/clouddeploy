export interface RepositoryFileInput {
  path: string;
  content?: string;
}

export interface AIServiceRecommendation {
  name: string;
  type: string;
  runtime: string;
  framework: string;
  rootDirectory: string;
  buildCommand: string | null;
  startCommand: string | null;
  port: number | null;
  confidence: number;
}

export interface ResourceRecommendation {
  cpuCores: number;
  ramMb: number;
  instances: number;
  databaseSizeMb: number | null;
  redisSizeMb: number | null;
  rationale: string[];
}

export interface RepositoryAnalysisResult {
  services: AIServiceRecommendation[];
  runtime: string[];
  framework: string[];
  buildCommand: string[];
  startCommand: string[];
  port: number[];
  databaseNeeds: { required: boolean; engine?: string; reason?: string };
  redisNeeds: { required: boolean; reason?: string };
  storageNeeds: { required: boolean; reason?: string };
  environmentVariableSuggestions: Array<{
    key: string;
    reason: string;
    secret: boolean;
    serviceName?: string;
  }>;
  resourceRecommendations: ResourceRecommendation;
  architecture: {
    summary: string;
    components: Array<{ id: string; label: string; kind: string; regionAffinity: string }>;
    connections: Array<{ from: string; to: string; purpose: string }>;
  };
  warnings: string[];
}

export type SafeFixActionType =
  | "ADD_ENVIRONMENT_VARIABLE"
  | "CONNECT_DATABASE"
  | "CHANGE_BUILD_COMMAND"
  | "CHANGE_START_COMMAND"
  | "GENERATE_DOCKERFILE"
  | "REDEPLOY";

export interface LogAnalysisResult {
  problem: string;
  explanation: string;
  affectedService: string | null;
  recommendedFix: string;
  confidence: number;
  actions: Array<{
    type: SafeFixActionType;
    title: string;
    explanation: string;
    payload: Record<string, unknown>;
    requiresReview: true;
  }>;
}

export interface DockerfileGenerationResult {
  dockerfile: string;
  path: string;
  explanation: string;
  warnings: string[];
}
