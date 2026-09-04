import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { BullModule } from "@nestjs/bullmq";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ProjectsModule } from "./projects/projects.module";
import { ServicesModule } from "./services/services.module";
import { DeploymentsModule } from "./deployments/deployments.module";
import { EnvironmentVariablesModule } from "./environment-variables/environment-variables.module";
import { DatabasesModule } from "./databases/databases.module";
import { DomainsModule } from "./domains/domains.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthModule } from "./health/health.module";
import { RedisDbModule } from "./redis-db/redis-db.module";
import { StorageModule } from "./storage/storage.module";
import { CronJobsModule } from "./cron-jobs/cron-jobs.module";
import { BillingModule } from "./billing/billing.module";
import { GithubModule } from "./github/github.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { UsageModule } from "./usage/usage.module";
import { AlertsModule } from "./alerts/alerts.module";
import { MetricsModule } from "./metrics/metrics.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>("REDIS_URL") },
      }),
    }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    ServicesModule,
    DeploymentsModule,
    EnvironmentVariablesModule,
    DatabasesModule,
    DomainsModule,
    DashboardModule,
    HealthModule,
    RedisDbModule,
    StorageModule,
    CronJobsModule,
    BillingModule,
    GithubModule,
    ApiKeysModule,
    WebhooksModule,
    NotificationsModule,
    UsageModule,
    AlertsModule,
    MetricsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
