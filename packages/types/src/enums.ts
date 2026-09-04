/**
 * Shared enums used across the control plane, build workers, runtime agents,
 * and the web frontend. These mirror the Prisma schema enums in
 * packages/database/prisma/schema.prisma — keep both in sync.
 */

export enum ServiceType {
  STATIC_SITE = "STATIC_SITE",
  WEB_SERVICE = "WEB_SERVICE",
  API_SERVICE = "API_SERVICE",
  PRIVATE_SERVICE = "PRIVATE_SERVICE",
  WORKER = "WORKER",
  CRON_JOB = "CRON_JOB",
  DOCKER_SERVICE = "DOCKER_SERVICE",
  POSTGRES = "POSTGRES",
  MYSQL = "MYSQL",
  MARIADB = "MARIADB",
  REDIS = "REDIS",
  OBJECT_STORAGE = "OBJECT_STORAGE",
}

export enum Runtime {
  NODE = "NODE",
  BUN = "BUN",
  DENO = "DENO",
  PYTHON = "PYTHON",
  PHP = "PHP",
  JAVA = "JAVA",
  GO = "GO",
  DOTNET = "DOTNET",
  RUBY = "RUBY",
  RUST = "RUST",
  STATIC = "STATIC",
  DOCKER = "DOCKER",
}

export enum Framework {
  // Node ecosystem
  EXPRESS = "EXPRESS",
  NESTJS = "NESTJS",
  NEXTJS = "NEXTJS",
  REACT = "REACT",
  VUE = "VUE",
  NUXT = "NUXT",
  ANGULAR = "ANGULAR",
  VITE = "VITE",
  REMIX = "REMIX",
  ASTRO = "ASTRO",
  // Python
  DJANGO = "DJANGO",
  FLASK = "FLASK",
  FASTAPI = "FASTAPI",
  // PHP
  LARAVEL = "LARAVEL",
  PHP_GENERIC = "PHP_GENERIC",
  // Java
  SPRING_BOOT = "SPRING_BOOT",
  // Generic fallbacks
  GO_GENERIC = "GO_GENERIC",
  DOTNET_GENERIC = "DOTNET_GENERIC",
  RUBY_GENERIC = "RUBY_GENERIC",
  RAILS = "RAILS",
  RUST_GENERIC = "RUST_GENERIC",
  DOCKERFILE = "DOCKERFILE",
  UNKNOWN = "UNKNOWN",
}

export enum DeploymentStatus {
  QUEUED = "QUEUED",
  CLONING = "CLONING",
  BUILDING = "BUILDING",
  UPLOADING = "UPLOADING",
  DEPLOYING = "DEPLOYING",
  HEALTH_CHECK = "HEALTH_CHECK",
  LIVE = "LIVE",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  ROLLED_BACK = "ROLLED_BACK",
}

export enum ServiceStatus {
  RUNNING = "RUNNING",
  BUILDING = "BUILDING",
  QUEUED = "QUEUED",
  FAILED = "FAILED",
  STOPPED = "STOPPED",
  PAUSED = "PAUSED",
  HEALTHY = "HEALTHY",
  DEGRADED = "DEGRADED",
  LIVE = "LIVE",
  MAINTENANCE = "MAINTENANCE",
}

export enum DatabaseEngine {
  POSTGRESQL = "POSTGRESQL",
  MYSQL = "MYSQL",
  MARIADB = "MARIADB",
  REDIS = "REDIS",
}

export enum BackupType {
  AUTOMATIC = "AUTOMATIC",
  MANUAL = "MANUAL",
}

export enum BackupStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum EnvironmentTarget {
  PRODUCTION = "PRODUCTION",
  PREVIEW = "PREVIEW",
  DEVELOPMENT = "DEVELOPMENT",
}

export enum DomainType {
  PLATFORM = "PLATFORM",
  CUSTOM = "CUSTOM",
}

export enum DomainStatus {
  PENDING = "PENDING",
  VERIFYING = "VERIFYING",
  ACTIVE = "ACTIVE",
  FAILED = "FAILED",
}

export enum SSLStatus {
  PENDING = "PENDING",
  ISSUING = "ISSUING",
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED",
}

export enum OrgRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  DEVELOPER = "DEVELOPER",
  BILLING_MANAGER = "BILLING_MANAGER",
  VIEWER = "VIEWER",
}

export enum MemberStatus {
  INVITED = "INVITED",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

export enum ProjectStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  ARCHIVED = "ARCHIVED",
}

export enum PlanTier {
  FREE = "FREE",
  DEVELOPER = "DEVELOPER",
  PRO = "PRO",
  BUSINESS = "BUSINESS",
  ENTERPRISE = "ENTERPRISE",
}

export enum SubscriptionStatus {
  TRIALING = "TRIALING",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELED = "CANCELED",
  INCOMPLETE = "INCOMPLETE",
}

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  PAID = "PAID",
  UNCOLLECTIBLE = "UNCOLLECTIBLE",
  VOID = "VOID",
}

export enum NodeRole {
  CONTROL_PLANE = "CONTROL_PLANE",
  BUILD_WORKER = "BUILD_WORKER",
  RUNTIME_NODE = "RUNTIME_NODE",
  DATABASE_NODE = "DATABASE_NODE",
  STORAGE_NODE = "STORAGE_NODE",
}

export enum NodeStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  DRAINING = "DRAINING",
  MAINTENANCE = "MAINTENANCE",
  DISABLED = "DISABLED",
}

export enum NotificationType {
  DEPLOYMENT_SUCCESSFUL = "DEPLOYMENT_SUCCESSFUL",
  DEPLOYMENT_FAILED = "DEPLOYMENT_FAILED",
  DATABASE_BACKUP_COMPLETED = "DATABASE_BACKUP_COMPLETED",
  DATABASE_BACKUP_FAILED = "DATABASE_BACKUP_FAILED",
  CPU_HIGH = "CPU_HIGH",
  RAM_HIGH = "RAM_HIGH",
  DISK_ALMOST_FULL = "DISK_ALMOST_FULL",
  SSL_ERROR = "SSL_ERROR",
  SERVER_DOWN = "SERVER_DOWN",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  DOMAIN_VERIFICATION_FAILED = "DOMAIN_VERIFICATION_FAILED",
}

export enum NotificationChannel {
  IN_APP = "IN_APP",
  EMAIL = "EMAIL",
  WEBHOOK = "WEBHOOK",
  SLACK = "SLACK",
  DISCORD = "DISCORD",
  WHATSAPP = "WHATSAPP",
}

export enum SupportTicketStatus {
  OPEN = "OPEN",
  WAITING = "WAITING",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum SupportTicketPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum AbuseReportType {
  SUSPICIOUS_DEPLOYMENT = "SUSPICIOUS_DEPLOYMENT",
  RESOURCE_ABUSE = "RESOURCE_ABUSE",
  SPAM = "SPAM",
  MALWARE = "MALWARE",
  CRYPTO_MINING = "CRYPTO_MINING",
}

export enum AbuseReportStatus {
  OPEN = "OPEN",
  INVESTIGATING = "INVESTIGATING",
  ACTION_TAKEN = "ACTION_TAKEN",
  DISMISSED = "DISMISSED",
}

export enum GitProvider {
  GITHUB = "GITHUB",
  GOOGLE = "GOOGLE",
}

export enum WebhookEvent {
  DEPLOYMENT_STARTED = "deployment.started",
  DEPLOYMENT_SUCCESS = "deployment.success",
  DEPLOYMENT_FAILED = "deployment.failed",
  DATABASE_BACKUP_COMPLETED = "database.backup.completed",
  SERVICE_RESTARTED = "service.restarted",
}

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export enum StatusPageState {
  OPERATIONAL = "OPERATIONAL",
  DEGRADED = "DEGRADED",
  PARTIAL_OUTAGE = "PARTIAL_OUTAGE",
  MAJOR_OUTAGE = "MAJOR_OUTAGE",
}
