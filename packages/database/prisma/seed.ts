import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { encryptSecret } from "@clouddeploy/security";

const prisma = new PrismaClient();

// Matches @clouddeploy/config's own default when ENCRYPTION_KEY isn't set in
// the environment. Prisma auto-loads packages/database/.env, so as long as
// that file's ENCRYPTION_KEY matches apps/api's, seed-encrypted secrets
// decrypt correctly through the real running API — see the note on
// PostgresAdminService for why the seeded database below is provisioned for
// real rather than left as a metadata-only row the API can't connect to.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "dev-only-encryption-key-change-me-in-prod!";
const encryptDevSecret = (plainText: string) => encryptSecret(plainText, ENCRYPTION_KEY);

const SHOPFRONT_DB_PASSWORD = "shopfront_dev_db_password_123!";

/**
 * Provisions the seeded "shopfront" database for real on the shared local
 * Postgres server — the same role/database primitives PostgresAdminService
 * uses for a database created through the app — so the demo project's SQL
 * editor, table browser, connections, and live metrics all work out of the
 * box instead of pointing at a role that doesn't exist. Idempotent: safe to
 * run against a server that already has these from a previous seed.
 */
async function provisionShopfrontDatabase(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const adminPool = new Pool({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: "postgres",
    max: 1,
  });

  try {
    const roleExists = await adminPool.query(`SELECT 1 FROM pg_roles WHERE rolname = 'shopfront_user'`);
    if (roleExists.rowCount === 0) {
      await adminPool.query(`CREATE ROLE shopfront_user WITH LOGIN PASSWORD '${SHOPFRONT_DB_PASSWORD.replace(/'/g, "''")}'`);
    }
    const dbExists = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname = 'shopfront'`);
    if (dbExists.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE shopfront OWNER shopfront_user`);
      await adminPool.query(`REVOKE CONNECT ON DATABASE shopfront FROM PUBLIC`);
      await adminPool.query(`GRANT CONNECT ON DATABASE shopfront TO shopfront_user`);
    }
  } finally {
    await adminPool.end();
  }

  const tenantPool = new Pool({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: "shopfront_user",
    password: SHOPFRONT_DB_PASSWORD,
    database: "shopfront",
    max: 1,
  });

  try {
    const tablesExist = await tenantPool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'users'`);
    if (tablesExist.rowCount === 0) {
      await tenantPool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          total_cents INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        INSERT INTO users (name, email, created_at) VALUES
          ('John Doe', 'john.doe@example.com', now() - interval '35 days'),
          ('Jane Smith', 'jane.smith@example.com', now() - interval '34 days'),
          ('Alex Kumar', 'alex.kumar@example.com', now() - interval '4 days'),
          ('Sara Lee', 'sara.lee@example.com', now() - interval '3 days');
        INSERT INTO orders (user_id, total_cents, status, created_at) VALUES
          (1, 4999, 'completed', now() - interval '30 days'),
          (1, 2500, 'completed', now() - interval '10 days'),
          (2, 12000, 'completed', now() - interval '20 days'),
          (3, 3499, 'pending', now() - interval '2 days');
      `);
    }
  } finally {
    await tenantPool.end();
  }
}

async function main() {
  console.log("Seeding CloudDeploy development data...");

  // ── Plans ────────────────────────────────────────────────────────────
  // upsert's `update` is set equal to `create` (minus the discriminant key)
  // for every plan below, so re-running this seed against an existing
  // database actually refreshes limits/features instead of silently
  // leaving stale rows in place (Prisma upsert does nothing on conflict
  // if `update` is empty — a real footgun the first version of this
  // seed had).
  const planDefs = [
    {
      tier: "FREE" as const,
      name: "Free",
      priceMonthlyCents: 0,
      priceYearlyCents: 0,
      maxProjects: 1,
      maxRamMb: 512,
      features: {
        staticSites: true, customDomain: false, backups: false,
        maxDatabases: 0, maxTeamMembers: 1, maxStorageGb: 1, maxBuildMinutes: 100, maxBandwidthGb: 10,
      },
    },
    {
      tier: "DEVELOPER" as const,
      name: "Developer",
      priceMonthlyCents: 500,
      priceYearlyCents: 5000,
      maxProjects: 5,
      maxRamMb: 2048,
      features: {
        customDomain: true, ssl: true, autoDeploy: true, basicBackups: true,
        maxDatabases: 1, maxTeamMembers: 3, maxStorageGb: 10, maxBuildMinutes: 500, maxBandwidthGb: 100,
      },
    },
    {
      tier: "PRO" as const,
      name: "Pro",
      priceMonthlyCents: 1500,
      priceYearlyCents: 15000,
      maxProjects: 20,
      maxRamMb: 4096,
      features: {
        redis: true, workers: true, cronJobs: true, dailyBackups: true, aiAssistant: true,
        maxDatabases: 5, maxTeamMembers: 10, maxStorageGb: 100, maxBuildMinutes: 2000, maxBandwidthGb: 500,
      },
    },
    {
      tier: "BUSINESS" as const,
      name: "Business",
      priceMonthlyCents: 4900,
      priceYearlyCents: 49000,
      maxProjects: 100,
      maxRamMb: 16384,
      features: {
        teamAccess: true, agencyFeatures: true, advancedMonitoring: true, prioritySupport: true,
        maxDatabases: 25, maxTeamMembers: 50, maxStorageGb: 1000, maxBuildMinutes: 10000, maxBandwidthGb: 5000,
      },
    },
    {
      tier: "ENTERPRISE" as const,
      name: "Enterprise",
      priceMonthlyCents: 0,
      priceYearlyCents: 0,
      maxProjects: 100000,
      maxRamMb: 1048576,
      features: {
        dedicatedInfra: true, privateNetwork: true, sla: true, whiteLabel: true,
        maxDatabases: 100000, maxTeamMembers: 100000, maxStorageGb: 1000000, maxBuildMinutes: 1000000, maxBandwidthGb: 1000000,
      },
    },
  ];

  const plans = await Promise.all(
    planDefs.map((def) => {
      const { tier, ...rest } = def;
      return prisma.plan.upsert({ where: { tier }, update: rest, create: def });
    }),
  );
  const proPlan = plans.find((p) => p.tier === "PRO")!;

  // ── Regions ──────────────────────────────────────────────────────────
  await Promise.all(
    [
      { code: "us-east", name: "Virginia", continent: "North America", country: "United States", city: "Ashburn" },
      { code: "us-west", name: "Oregon", continent: "North America", country: "United States", city: "Portland" },
      { code: "eu-west", name: "Ireland", continent: "Europe", country: "Ireland", city: "Dublin" },
      { code: "eu-central", name: "Frankfurt", continent: "Europe", country: "Germany", city: "Frankfurt" },
      { code: "ap-south", name: "Mumbai", continent: "Asia", country: "India", city: "Mumbai" },
      { code: "ap-southeast", name: "Singapore", continent: "Asia", country: "Singapore", city: "Singapore" },
      { code: "me-central", name: "Dubai", continent: "Asia", country: "United Arab Emirates", city: "Dubai" },
    ].map((r) => prisma.region.upsert({ where: { code: r.code }, update: { ...r, active: true }, create: r })),
  );

  // ── Admin user ───────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@clouddeploy.dev" },
    update: {},
    create: {
      email: "admin@clouddeploy.dev",
      fullName: "Ada Admin",
      passwordHash,
      emailVerifiedAt: new Date(),
      isPlatformAdmin: true,
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@clouddeploy.dev" },
    update: {},
    create: {
      email: "demo@clouddeploy.dev",
      fullName: "Dana Developer",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  // ── Public status page & local regional capacity ────────────────────
  for (const [sortOrder, name] of ["API", "Dashboard", "Build System", "Runtime", "Databases", "Storage", "DNS", "SSL", "GitHub Integration"].entries()) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.platformService.upsert({ where: { slug }, create: { slug, name, sortOrder }, update: { name, sortOrder } });
  }

  const runtimeServer = await prisma.server.upsert({
    where: { hostname: "local-runtime-us-east" },
    create: { hostname: "local-runtime-us-east", ipAddress: "127.0.0.1", region: "us-east", role: "RUNTIME_NODE", cpuCores: 16, ramMb: 32768, diskMb: 262144, lastHeartbeatAt: new Date() },
    update: { status: "ONLINE", lastHeartbeatAt: new Date() },
  });
  await prisma.runtimeNode.upsert({ where: { serverId: runtimeServer.id }, create: { serverId: runtimeServer.id, region: "us-east", totalCpuCores: 16, totalRamMb: 32768, totalDiskMb: 262144 }, update: { status: "ONLINE" } });

  const buildServer = await prisma.server.upsert({
    where: { hostname: "local-builder-us-east" },
    create: { hostname: "local-builder-us-east", ipAddress: "127.0.0.1", region: "us-east", role: "BUILD_WORKER", cpuCores: 8, ramMb: 16384, diskMb: 131072, lastHeartbeatAt: new Date() },
    update: { status: "ONLINE", lastHeartbeatAt: new Date() },
  });
  await prisma.buildWorker.upsert({ where: { serverId: buildServer.id }, create: { serverId: buildServer.id, region: "us-east", maxConcurrentBuilds: 4 }, update: { status: "ONLINE" } });

  // ── Organization ─────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "acme-inc" },
    update: { isAgency: true },
    create: {
      name: "Acme Inc",
      slug: "acme-inc",
      isAgency: true,
      members: {
        create: [
          { email: adminUser.email, userId: adminUser.id, role: "OWNER", status: "ACTIVE", joinedAt: new Date() },
          { email: demoUser.email, userId: demoUser.id, role: "DEVELOPER", status: "ACTIVE", joinedAt: new Date() },
        ],
      },
      subscription: {
        create: {
          planId: proPlan.id,
          status: "ACTIVE",
          billingPeriod: "monthly",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  // ── Sample project with frontend + backend services ─────────────────
  const project = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "shopfront" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "ShopFront",
      slug: "shopfront",
      description: "Full-stack e-commerce storefront",
      status: "ACTIVE",
      region: "us-east",
      productionUrl: null,
      createdBy: demoUser.id,
    },
  });

  const agencyClient = await prisma.agencyClient.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "ops@northstar.example" } },
    create: { organizationId: org.id, name: "Maya Chen", company: "Northstar Retail", email: "ops@northstar.example", phone: "+1 555 0142", billingReference: "NS-2026", notes: "Priority ecommerce client" },
    update: { status: "ACTIVE" },
  });
  await prisma.clientProject.upsert({ where: { projectId: project.id }, create: { clientId: agencyClient.id, projectId: project.id, monthlyCostCents: 3200, monthlyRevenueCents: 7900 }, update: { clientId: agencyClient.id, monthlyCostCents: 3200, monthlyRevenueCents: 7900 } });
  await prisma.clientPortalAccess.upsert({ where: { clientId: agencyClient.id }, create: { clientId: agencyClient.id, metricsReadOnly: true, invoicesVisible: true, deploymentStatus: true, domainStatus: true, supportAccess: true }, update: {} });
  await prisma.agencyBranding.upsert({ where: { organizationId: org.id }, create: { organizationId: org.id, brandName: "Acme Cloud Studio", primaryAccent: "#2563eb", supportEmail: "support@acme.example" }, update: {} });

  const frontend = (await prisma.service.findFirst({ where: { projectId: project.id, name: "frontend" } })) ?? await prisma.service.create({
    data: {
      projectId: project.id,
      name: "frontend",
      type: "WEB_SERVICE",
      runtime: "NODE",
      framework: "NEXTJS",
      status: "RUNNING",
      rootDirectory: "frontend",
      buildCommand: "npm run build",
      startCommand: "npm start",
      port: 3000,
      cpuCores: 0.5,
      ramMb: 512,
      publicUrl: null,
      internalHostname: "frontend.internal",
    },
  });

  const backend = (await prisma.service.findFirst({ where: { projectId: project.id, name: "backend" } })) ?? await prisma.service.create({
    data: {
      projectId: project.id,
      name: "backend",
      type: "API_SERVICE",
      runtime: "NODE",
      framework: "NESTJS",
      status: "RUNNING",
      rootDirectory: "backend",
      buildCommand: "npm run build",
      startCommand: "npm run start:prod",
      port: 5000,
      cpuCores: 1,
      ramMb: 1024,
      publicUrl: null,
      internalHostname: "backend.internal",
    },
  });

  await prisma.autoscalingPolicy.upsert({
    where: { serviceId: backend.id },
    create: { projectId: project.id, serviceId: backend.id, enabled: true, minimumInstances: 1, maximumInstances: 5, cpuThresholdPct: 75, memoryThresholdPct: 80, requestThreshold: 2500, scaleUpCooldownSeconds: 120, scaleDownCooldownSeconds: 300 },
    update: {},
  });

  const dbService = (await prisma.service.findFirst({ where: { projectId: project.id, name: "database" } })) ?? await prisma.service.create({
    data: {
      projectId: project.id,
      name: "database",
      type: "POSTGRES",
      runtime: "DOCKER",
      framework: "UNKNOWN",
      status: "RUNNING",
      rootDirectory: ".",
      cpuCores: 0.5,
      ramMb: 1024,
      internalHostname: "postgres.internal",
    },
  });

  await provisionShopfrontDatabase();

  await prisma.database.upsert({
    where: { serviceId: dbService.id },
    update: {},
    create: {
      organizationId: org.id,
      serviceId: dbService.id,
      name: "shopfront-db",
      engine: "POSTGRESQL",
      version: "16",
      status: "RUNNING",
      region: "us-east",
      host: "shopfront-db.clouddeploy.app",
      privateHost: "postgres.internal",
      port: 5432,
      databaseName: "shopfront",
      username: "shopfront_user",
      passwordCipher: encryptDevSecret(SHOPFRONT_DB_PASSWORD),
      storageMb: 4096,
      storageUsedMb: 512,
    },
  });

  const existingDomain = await prisma.domain.findUnique({ where: { hostname: "shopfront.clouddeploy.app" } });
  if (!existingDomain) {
    await prisma.domain.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        hostname: "shopfront.clouddeploy.app",
        type: "PLATFORM",
        status: "PENDING",
        dnsRecords: {
          wildcard: { type: "A", name: "*.clouddeploy.app", value: "<PUBLIC_SERVER_IP>", ttl: 300 },
        },
        verifiedAt: null,
        ssl: {
          create: {
            status: "PENDING",
          },
        },
      },
    });
  }

  const existingDeployment = await prisma.deployment.findFirst({ where: { projectId: project.id, commitSha: "a1b2c3d" } });
  const deployment = existingDeployment ?? await prisma.deployment.create({
    data: {
      projectId: project.id,
      serviceId: frontend.id,
      environment: "PRODUCTION",
      status: "LIVE",
      branch: "main",
      commitSha: "a1b2c3d",
      commitMessage: "feat: launch checkout flow",
      triggeredById: demoUser.id,
      progressPct: 100,
      currentStep: "Deploy Live",
      startedAt: new Date(Date.now() - 60_000),
      finishedAt: new Date(),
      durationMs: 58_000,
    },
  });

  if (!existingDeployment) {
    await prisma.deploymentLog.createMany({
      data: [
        "Cloning repository...",
        "Repository cloned successfully",
        "Detected Next.js frontend",
        "Detected NestJS backend",
        "Installing dependencies...",
        "Building frontend...",
        "Building backend...",
        "Creating Docker image...",
        "Provisioning PostgreSQL...",
        "Starting containers...",
        "Configuring Traefik...",
        "Issuing SSL...",
        "Health check passed",
        "Deployment successful",
      ].map((message, i) => ({
        deploymentId: deployment.id,
        level: "INFO" as const,
        message,
        timestamp: new Date(Date.now() - (14 - i) * 4000),
      })),
    });
  }

  await prisma.metric.createMany({
    data: Array.from({ length: 24 }).map((_, i) => ({
      serviceId: backend.id,
      cpuPct: 20 + Math.random() * 40,
      ramMb: 400 + Math.random() * 300,
      requestCount: Math.floor(Math.random() * 500),
      errorRate: Math.random() * 2,
      latencyMs: 50 + Math.random() * 150,
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000),
    })),
  });

  for (const envVar of [
    { key: "NODE_ENV", value: "production", isSecret: false },
    { key: "DATABASE_URL", value: `postgres://shopfront_user:${SHOPFRONT_DB_PASSWORD}@postgres.internal:5432/shopfront`, isSecret: true },
    { key: "JWT_SECRET", value: "dev-seed-demo-jwt-secret-not-used-for-real-auth", isSecret: true },
  ]) {
    await prisma.environmentVariable.upsert({
      where: { projectId_serviceId_environment_key: { projectId: project.id, serviceId: backend.id, environment: "PRODUCTION", key: envVar.key } },
      update: {},
      create: { projectId: project.id, serviceId: backend.id, key: envVar.key, valueCipher: encryptDevSecret(envVar.value), isSecret: envVar.isSecret },
    });
  }

  // ── Template marketplace ─────────────────────────────────────────────
  // servicesJson is untyped at the schema level (jsonb) — its contract is
  // TemplateDefinition in apps/api/src/templates/template-definition.ts.
  // Every template deploys through the exact same real provisioning code
  // as a hand-built project (real Database/Redis when needed, real
  // generated secrets, a real queued Deployment) — the only thing that's
  // template-specific is which public Docker image and env var names to
  // use, since the underlying container-run step is the same simulated
  // step every deployment in this MVP goes through (see README).
  const categoryDefs = [
    { name: "Framework Starters", slug: "framework-starters" },
    { name: "Full-stack", slug: "full-stack" },
    { name: "Automation", slug: "automation" },
    { name: "Headless CMS", slug: "headless-cms" },
    { name: "Analytics & BI", slug: "analytics-bi" },
    { name: "Monitoring", slug: "monitoring" },
    { name: "CMS & Blogging", slug: "cms-blogging" },
    { name: "Security", slug: "security" },
  ];
  const categories: Record<string, { id: string }> = {};
  for (const c of categoryDefs) {
    categories[c.slug] = await prisma.templateCategory.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name } });
  }

  const templateDefs = [
    {
      slug: "nextjs",
      name: "Next.js",
      categorySlug: "framework-starters",
      description: "Production-ready Next.js starter with a health check and region-aware web service.",
      logoUrl: "https://cdn.simpleicons.org/nextdotjs",
      repositoryUrl: "https://github.com/vercel/next.js/tree/canary/examples/hello-world",
      isFeatured: true,
      estimatedMonthlyUsd: 5,
      requiredEnvVars: [],
      servicesJson: {
        services: [{ name: "web", type: "WEB_SERVICE", runtime: "NODE", framework: "NEXTJS", rootDirectory: ".", buildCommand: "npm run build", startCommand: "npm start", port: 3000, healthCheckPath: "/" }],
        resourcePreset: "starter",
      },
    },
    {
      slug: "react-node",
      name: "React + Node",
      categorySlug: "full-stack",
      description: "Two-service React frontend and Express API with private service discovery.",
      logoUrl: "https://cdn.simpleicons.org/react",
      isFeatured: true,
      estimatedMonthlyUsd: 10,
      requiredEnvVars: ["SESSION_SECRET"],
      servicesJson: {
        services: [
          { name: "frontend", type: "STATIC_SITE", runtime: "NODE", framework: "REACT", rootDirectory: "frontend", buildCommand: "npm run build", startCommand: "npm run preview -- --host 0.0.0.0", port: 4173, healthCheckPath: "/" },
          { name: "api", type: "API_SERVICE", runtime: "NODE", framework: "EXPRESS", rootDirectory: "api", buildCommand: "npm run build", startCommand: "npm start", port: 3000, healthCheckPath: "/health" },
        ],
        databaseTargetService: "api",
        needsDatabase: true,
        resourcePreset: "starter",
      },
    },
    {
      slug: "mern",
      name: "MERN",
      categorySlug: "full-stack",
      description: "React and Node starter prepared for an external MongoDB connection.",
      logoUrl: "https://cdn.simpleicons.org/mongodb",
      isFeatured: false,
      estimatedMonthlyUsd: 10,
      requiredEnvVars: ["MONGODB_URI", "SESSION_SECRET"],
      servicesJson: {
        services: [
          { name: "frontend", type: "STATIC_SITE", runtime: "NODE", framework: "REACT", rootDirectory: "client", buildCommand: "npm run build", startCommand: "npm run preview -- --host 0.0.0.0", port: 4173 },
          { name: "api", type: "API_SERVICE", runtime: "NODE", framework: "EXPRESS", rootDirectory: "server", buildCommand: "npm run build", startCommand: "npm start", port: 3000, healthCheckPath: "/health" },
        ],
        resourcePreset: "starter",
      },
    },
    {
      slug: "laravel",
      name: "Laravel",
      categorySlug: "framework-starters",
      description: "Laravel application service with a colocated managed MySQL database definition.",
      logoUrl: "https://cdn.simpleicons.org/laravel",
      repositoryUrl: "https://github.com/laravel/laravel",
      isFeatured: false,
      estimatedMonthlyUsd: 10,
      requiredEnvVars: ["APP_KEY"],
      servicesJson: {
        services: [{ name: "app", type: "API_SERVICE", runtime: "PHP", framework: "LARAVEL", buildCommand: "composer install --no-dev --optimize-autoloader", startCommand: "php artisan serve --host=0.0.0.0 --port=8000", port: 8000, healthCheckPath: "/up" }],
        needsDatabase: true,
        databaseEngine: "MYSQL",
        databaseEnvVars: { host: "DB_HOST", port: "DB_PORT", database: "DB_DATABASE", username: "DB_USERNAME", password: "DB_PASSWORD" },
        staticEnvVars: { DB_CONNECTION: "mysql" },
        resourcePreset: "starter",
      },
    },
    {
      slug: "django",
      name: "Django",
      categorySlug: "framework-starters",
      description: "Django web service with PostgreSQL, static storage, and secure defaults.",
      logoUrl: "https://cdn.simpleicons.org/django",
      isFeatured: false,
      estimatedMonthlyUsd: 10,
      requiredEnvVars: ["DJANGO_SECRET_KEY"],
      servicesJson: {
        services: [{ name: "web", type: "WEB_SERVICE", runtime: "PYTHON", framework: "DJANGO", buildCommand: "pip install -r requirements.txt && python manage.py collectstatic --noinput", startCommand: "gunicorn config.wsgi:application --bind 0.0.0.0:8000", port: 8000, healthCheckPath: "/health" }],
        needsDatabase: true,
        storage: [{ name: "media", isPublic: true }],
        resourcePreset: "starter",
      },
    },
    {
      slug: "wordpress",
      name: "WordPress",
      categorySlug: "cms-blogging",
      description: "Official WordPress image with a managed MySQL database and persistent content volume definition.",
      logoUrl: "https://cdn.simpleicons.org/wordpress",
      isFeatured: true,
      estimatedMonthlyUsd: 12,
      requiredEnvVars: [],
      servicesJson: {
        services: [{ name: "wordpress", dockerImage: "wordpress:6-php8.3-apache", type: "DOCKER_SERVICE", runtime: "DOCKER", framework: "UNKNOWN", port: 80, healthCheckPath: "/", volumes: [{ mountPath: "/var/www/html/wp-content", sizeMb: 5120 }] }],
        needsDatabase: true,
        databaseEngine: "MYSQL",
        databaseEnvVars: { host: "WORDPRESS_DB_HOST", database: "WORDPRESS_DB_NAME", username: "WORDPRESS_DB_USER", password: "WORDPRESS_DB_PASSWORD" },
        resourcePreset: "starter",
      },
    },
    {
      slug: "n8n",
      name: "n8n",
      categorySlug: "automation",
      description: "Workflow automation platform — connect APIs and automate tasks with a visual editor.",
      logoUrl: "https://cdn.simpleicons.org/n8n",
      isFeatured: true,
      estimatedMonthlyUsd: 7,
      requiredEnvVars: ["N8N_ENCRYPTION_KEY"],
      servicesJson: {
        service: { name: "n8n", dockerImage: "n8nio/n8n:latest", port: 5678, healthCheckPath: "/healthz" },
        needsDatabase: true,
        databaseEnvVars: {
          host: "DB_POSTGRESDB_HOST",
          port: "DB_POSTGRESDB_PORT",
          database: "DB_POSTGRESDB_DATABASE",
          username: "DB_POSTGRESDB_USER",
          password: "DB_POSTGRESDB_PASSWORD",
        },
        staticEnvVars: { DB_TYPE: "postgresdb" },
        resourcePreset: "starter",
      },
    },
    {
      slug: "strapi",
      name: "Strapi",
      categorySlug: "headless-cms",
      description: "Open-source headless CMS for building customizable APIs and content backends.",
      logoUrl: "https://cdn.simpleicons.org/strapi",
      isFeatured: true,
      estimatedMonthlyUsd: 7,
      requiredEnvVars: ["APP_KEYS", "API_TOKEN_SALT", "ADMIN_JWT_SECRET", "TRANSFER_TOKEN_SALT", "JWT_SECRET"],
      servicesJson: {
        service: { name: "strapi", dockerImage: "strapi/strapi:latest", port: 1337, healthCheckPath: "/_health" },
        needsDatabase: true,
        databaseEnvVars: {
          host: "DATABASE_HOST",
          port: "DATABASE_PORT",
          database: "DATABASE_NAME",
          username: "DATABASE_USERNAME",
          password: "DATABASE_PASSWORD",
        },
        staticEnvVars: { DATABASE_CLIENT: "postgres" },
        resourcePreset: "starter",
      },
    },
    {
      slug: "directus",
      name: "Directus",
      categorySlug: "headless-cms",
      description: "Instant REST + GraphQL APIs and a no-code data studio on top of your own database.",
      logoUrl: "https://cdn.simpleicons.org/directus",
      isFeatured: false,
      estimatedMonthlyUsd: 7,
      requiredEnvVars: ["KEY", "SECRET"],
      servicesJson: {
        service: { name: "directus", dockerImage: "directus/directus:latest", port: 8055, healthCheckPath: "/server/health" },
        needsDatabase: true,
        databaseEnvVars: {
          host: "DB_HOST",
          port: "DB_PORT",
          database: "DB_DATABASE",
          username: "DB_USER",
          password: "DB_PASSWORD",
        },
        staticEnvVars: { DB_CLIENT: "pg" },
        resourcePreset: "starter",
      },
    },
    {
      slug: "metabase",
      name: "Metabase",
      categorySlug: "analytics-bi",
      description: "Open-source business intelligence tool for dashboards and ad-hoc querying.",
      logoUrl: "https://cdn.simpleicons.org/metabase",
      isFeatured: true,
      estimatedMonthlyUsd: 10,
      requiredEnvVars: [],
      servicesJson: {
        service: { name: "metabase", dockerImage: "metabase/metabase:latest", port: 3000, healthCheckPath: "/api/health" },
        needsDatabase: true,
        databaseEnvVars: { connectionUrl: "MB_DB_CONNECTION_URI" },
        staticEnvVars: { MB_DB_TYPE: "postgres" },
        resourcePreset: "developer",
      },
    },
    {
      slug: "grafana",
      name: "Grafana",
      categorySlug: "monitoring",
      description: "Dashboards and visualization for metrics, logs, and traces from any data source.",
      logoUrl: "https://cdn.simpleicons.org/grafana",
      isFeatured: false,
      estimatedMonthlyUsd: 5,
      requiredEnvVars: ["GF_SECURITY_ADMIN_PASSWORD"],
      servicesJson: {
        service: { name: "grafana", dockerImage: "grafana/grafana:latest", port: 3000, healthCheckPath: "/api/health" },
        resourcePreset: "starter",
      },
    },
    {
      slug: "uptime-kuma",
      name: "Uptime Kuma",
      categorySlug: "monitoring",
      description: "Self-hosted uptime monitoring with status pages and multi-channel alerting.",
      logoUrl: "https://cdn.simpleicons.org/uptimekuma",
      isFeatured: false,
      estimatedMonthlyUsd: 5,
      requiredEnvVars: [],
      servicesJson: {
        service: { name: "uptime-kuma", dockerImage: "louislam/uptime-kuma:latest", port: 3001, healthCheckPath: "/" },
        resourcePreset: "nano",
      },
    },
    {
      slug: "ghost",
      name: "Ghost",
      categorySlug: "cms-blogging",
      description: "Modern publishing platform for blogs and newsletters.",
      logoUrl: "https://cdn.simpleicons.org/ghost",
      isFeatured: true,
      estimatedMonthlyUsd: 5,
      requiredEnvVars: [],
      servicesJson: {
        service: { name: "ghost", dockerImage: "ghost:5", port: 2368, healthCheckPath: "/" },
        staticEnvVars: {
          database__client: "sqlite3",
          database__connection__filename: "/var/lib/ghost/content/data/ghost.db",
          database__useNullAsDefault: "true",
        },
        resourcePreset: "starter",
      },
    },
    {
      slug: "vaultwarden",
      name: "Vaultwarden",
      categorySlug: "security",
      description: "Lightweight, Bitwarden-compatible self-hosted password manager server.",
      logoUrl: "https://cdn.simpleicons.org/vaultwarden",
      isFeatured: false,
      estimatedMonthlyUsd: 5,
      requiredEnvVars: ["ADMIN_TOKEN"],
      servicesJson: {
        service: { name: "vaultwarden", dockerImage: "vaultwarden/server:latest", port: 80, healthCheckPath: "/alive" },
        resourcePreset: "nano",
      },
    },
  ];

  for (const t of templateDefs) {
    const { categorySlug, ...rest } = t;
    const data = { ...rest, categoryId: categories[categorySlug]!.id };
    await prisma.template.upsert({ where: { slug: t.slug }, create: data, update: data });
  }

  console.log("Seed complete:");
  console.log(`  Admin login: admin@clouddeploy.dev / Password123!`);
  console.log(`  Demo login:  demo@clouddeploy.dev / Password123!`);
  console.log(`  Organization: ${org.slug}`);
  console.log(`  Project: ${project.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
