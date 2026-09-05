/** The shape stored in Template.servicesJson (a jsonb column — Prisma has
 * no way to type that at the schema level, so this is the contract every
 * seeded template and TemplatesService.deploy() agree on). Kept to a
 * single primary service because every seeded template today is a
 * single-container app; a future multi-service template would need
 * deploy() to loop and pick one service to carry the Build's image tag. */
export interface TemplateServiceDefinition {
  name: string;
  dockerImage?: string;
  port: number;
  healthCheckPath?: string;
  type?: "STATIC_SITE" | "WEB_SERVICE" | "API_SERVICE" | "PRIVATE_SERVICE" | "WORKER" | "DOCKER_SERVICE";
  runtime?: "NODE" | "PYTHON" | "PHP" | "DOCKER";
  framework?: "NEXTJS" | "REACT" | "EXPRESS" | "DJANGO" | "LARAVEL" | "DOCKERFILE" | "UNKNOWN";
  rootDirectory?: string;
  buildCommand?: string;
  startCommand?: string;
  volumes?: Array<{ mountPath: string; sizeMb: number }>;
}

/** Maps the real provisioned database's connection info onto the specific
 * env var names this particular app expects — every app names these
 * differently (n8n wants discrete DB_POSTGRESDB_* vars, Metabase wants a
 * single connection-URI var, etc.), so a single hardcoded "DATABASE_URL"
 * wouldn't actually get read by most of them. */
export interface DatabaseEnvVarMapping {
  host?: string;
  port?: string;
  database?: string;
  username?: string;
  password?: string;
  connectionUrl?: string;
}

export interface TemplateDefinition {
  /** Legacy single-service shape remains supported for existing marketplace entries. */
  service?: TemplateServiceDefinition;
  services?: TemplateServiceDefinition[];
  needsDatabase?: boolean;
  databaseEngine?: "POSTGRESQL" | "MYSQL" | "MARIADB";
  databaseEnvVars?: DatabaseEnvVarMapping;
  needsRedis?: boolean;
  resourcePreset?: "nano" | "starter" | "developer" | "pro";
  /** Fixed, non-secret config values the image needs to boot correctly
   * (e.g. Ghost's sqlite client selection) — written as plain env vars. */
  staticEnvVars?: Record<string, string>;
  databaseTargetService?: string;
  redisTargetService?: string;
  storage?: Array<{ name: string; isPublic?: boolean }>;
  domains?: Array<{ serviceName: string; environment: "PRODUCTION" | "PREVIEW" }>;
}
