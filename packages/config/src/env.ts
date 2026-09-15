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
  MYSQL_URL: z.string().min(1).optional(),
  MONGO_URL: z.string().min(1).optional(),
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
  TRAEFIK_DYNAMIC_CONFIG_PATH: z.string().optional(),
  PLATFORM_INGRESS_IP: z.string().optional(),
  MONGO_CONTAINER_NAME: z.string().default("clouddeploy-mongo-1"),
  MYSQL_CONTAINER_NAME: z.string().default("clouddeploy-mysql-1"),
  TRIVY_REQUIRED: z.string().optional(),
  SANDBOX_READ_ONLY: z.string().optional(),

  WEB_APP_URL: z.string().default("http://localhost:3000"),
  API_URL: z.string().default("http://localhost:4000"),
  PLATFORM_DOMAIN: z.string().default("clouddeploy.local"),

  COOKIE_SECRET: z.string().min(32).default("dev-only-cookie-secret-change-me-in-prod!!"),
  ENCRYPTION_KEY: z.string().min(32).default("dev-only-encryption-key-change-me-in-prod!"),
  /** Set to the outgoing key while a rotation is in progress — every
   * encrypted column falls back to this key when ENCRYPTION_KEY can't
   * decrypt a row, so reads keep working mid-rotation. Remove it once
   * POST /admin/security/rotate-encryption-key reports every row rotated. */
  ENCRYPTION_KEY_PREVIOUS: z.string().min(32).optional(),

  /** Defaults target the local Mailpit container (infra/docker/docker-compose.yml)
   * which accepts any SMTP auth and exposes a web UI at :8025 to read what was sent. */
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("CloudDeploy <notifications@clouddeploy.local>"),
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
  const env = result.data;
  if (env.NODE_ENV === "production") {
    const missing: string[] = [];
    if (!env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
    if (!env.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");
    if (missing.length) {
      throw new Error(`Production billing is not configured:\n${missing.map((k) => `  - ${k}`).join("\n")}`);
    }
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith("sk_live_") && !env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
      throw new Error("STRIPE_SECRET_KEY must be a Stripe secret key (sk_live_ or sk_test_)");
    }
  }
  return env;
}
