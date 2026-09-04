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
