import { z } from "zod";

/**
 * Canonical environment schema for the API/control-plane process.
 * Validated once at boot (see apps/api/src/config/env.validation.ts) so the
 * process fails fast with a clear message instead of crashing deep in a
 * request handler when a variable is missing.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_ACCESS_KEY: z.string().default("clouddeploy"),
  S3_SECRET_KEY: z.string().default("clouddeploy-dev-secret"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("clouddeploy-platform"),
  S3_BACKUPS_BUCKET: z.string().default("clouddeploy-backups"),

  /** Container running the shared local Postgres instance — see the note on
   * PostgresAdminService for why `docker exec` is used for pg_dump/psql
   * locally instead of shelling out directly. */
  POSTGRES_CONTAINER_NAME: z.string().default("clouddeploy-postgres-1"),

  REGISTRY_URL: z.string().default("localhost:5001"),
  TRAEFIK_API: z.string().default("http://localhost:8090"),

  WEB_APP_URL: z.string().default("http://localhost:3000"),
  API_URL: z.string().default("http://localhost:4000"),
  PLATFORM_DOMAIN: z.string().default("clouddeploy.local"),

  COOKIE_SECRET: z.string().min(32).default("dev-only-cookie-secret-change-me-in-prod!!"),
  ENCRYPTION_KEY: z.string().min(32).default("dev-only-encryption-key-change-me-in-prod!"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return result.data;
}
