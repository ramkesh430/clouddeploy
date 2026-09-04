import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
      { code: "us-east", name: "US East (Virginia)", continent: "North America" },
      { code: "us-west", name: "US West (Oregon)", continent: "North America" },
      { code: "eu-west", name: "EU West (Ireland)", continent: "Europe" },
      { code: "ap-south", name: "Asia Pacific (Mumbai)", continent: "Asia" },
    ].map((r) => prisma.region.upsert({ where: { code: r.code }, update: {}, create: r })),
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

  // ── Organization ─────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "acme-inc" },
    update: {},
    create: {
      name: "Acme Inc",
      slug: "acme-inc",
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
      productionUrl: "https://shopfront.clouddeploy.app",
      createdBy: demoUser.id,
    },
  });

  const frontend = await prisma.service.create({
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
      publicUrl: "https://shopfront.clouddeploy.app",
      internalHostname: "frontend.internal",
    },
  });

  const backend = await prisma.service.create({
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
      publicUrl: "https://api.shopfront.clouddeploy.app",
      internalHostname: "backend.internal",
    },
  });

  const dbService = await prisma.service.create({
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

  await prisma.database.create({
    data: {
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
      passwordCipher: "enc:dev-only-placeholder",
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
        status: "ACTIVE",
        dnsRecords: {},
        verifiedAt: new Date(),
        ssl: {
          create: {
            status: "ACTIVE",
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
  }

  const deployment = await prisma.deployment.create({
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

  await prisma.environmentVariable.createMany({
    data: [
      { projectId: project.id, serviceId: backend.id, key: "NODE_ENV", valueCipher: "enc:production", isSecret: false },
      { projectId: project.id, serviceId: backend.id, key: "DATABASE_URL", valueCipher: "enc:postgres://***", isSecret: true },
      { projectId: project.id, serviceId: backend.id, key: "JWT_SECRET", valueCipher: "enc:***", isSecret: true },
    ],
  });

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
