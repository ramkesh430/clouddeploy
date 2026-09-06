import {
  BarChart3,
  Braces,
  CircleHelp,
  CreditCard,
  Database,
  Globe2,
  HardDrive,
  Layers3,
  type LucideIcon,
  Rocket,
  Server,
  Terminal,
  Workflow,
} from "lucide-react";

export interface DocCodeBlock {
  language?: string;
  code: string;
}

export interface DocCallout {
  tone: "info" | "success" | "warning";
  text: string;
}

export interface DocSection {
  id: string;
  heading: string;
  step?: number;
  paragraphs?: string[];
  list?: string[];
  table?: { headers: string[]; rows: string[][] };
  code?: DocCodeBlock;
  callout?: DocCallout;
}

export interface DocPage {
  slug: string;
  title: string;
  icon: LucideIcon;
  description: string;
  sections: DocSection[];
}

export const DOCS_PAGES: DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    icon: Rocket,
    description: "Deploy your first application in minutes with CloudDeploy — from zero to a live URL.",
    sections: [
      {
        id: "create-account",
        heading: "Create an account",
        step: 1,
        paragraphs: ["First, create a free CloudDeploy account. No credit card required — the Free plan supports one project out of the box."],
      },
      {
        id: "install-cli",
        heading: "Install the CLI (optional)",
        step: 2,
        paragraphs: ["The CloudDeploy CLI lets you deploy and manage your applications from your terminal."],
        code: { code: "npm install -g @clouddeploy/cli\n\nclouddeploy login --api-key <your-api-key>" },
        callout: { tone: "info", text: "Create an API key from your dashboard under Settings → API Keys. You can also deploy directly by connecting GitHub in the dashboard without installing the CLI." },
      },
      {
        id: "deploy",
        heading: "Deploy your application",
        step: 3,
        paragraphs: ["Once your project exists (created via the dashboard or clouddeploy init), trigger a new deployment for it directly from the CLI."],
        code: { code: "clouddeploy deploy --project <project-id>\n\n# Stream live logs for a deployment\nclouddeploy logs <deployment-id> --follow" },
        callout: { tone: "success", text: "Your application builds and deploys to a live URL — watch progress in the dashboard or via clouddeploy logs." },
      },
      {
        id: "visit",
        heading: "Visit your live application",
        step: 4,
        paragraphs: ["Once the deployment is live, open the generated production URL from your project's Overview page."],
      },
    ],
  },
  {
    slug: "deployments",
    title: "Deployments",
    icon: Layers3,
    description: "What happens between pushing code and having it live, and how rollbacks and preview environments work.",
    sections: [
      {
        id: "pipeline",
        heading: "The deployment pipeline",
        paragraphs: [
          "Every deployment goes through the same named steps, streamed live to the Deployments tab: clone repository, analyze, install dependencies, build frontend/backend, create the Docker image, provision the database (first deploy only), start containers, configure Traefik routing, issue SSL, then a health check before the deployment is marked live.",
          "A rollback or a template deploy skips the build steps entirely and reuses an already-built image, so it goes live in seconds rather than rebuilding from source.",
        ],
      },
      {
        id: "environments",
        heading: "Production vs. preview",
        paragraphs: [
          "A production deployment updates your project's permanent URL. A preview deployment gets its own throwaway URL and is meant for a branch or pull request — it's automatically torn down once that branch's PR closes.",
        ],
      },
      {
        id: "rollback",
        heading: "Rolling back",
        paragraphs: [
          "Rollback reuses the exact Docker image from the target deployment — no rebuild — and only switches traffic over after that image passes its health check. The deployment you rolled back from is marked Rolled Back, not deleted.",
        ],
      },
      {
        id: "auto-deploy",
        heading: "Auto-deploy on push",
        paragraphs: ["Connect a GitHub repository and every push to the tracked branch triggers a new deployment automatically — no manual step required."],
      },
    ],
  },
  {
    slug: "services",
    title: "Services",
    icon: Server,
    description: "Service types, resource sizing, and how build/start commands work.",
    sections: [
      {
        id: "types",
        heading: "Service types",
        paragraphs: ["Each service in a project has a type that determines how it's built and run:"],
        list: [
          "Static Site / Web Service — frontends like React, Next.js, Vue",
          "API Service / Private Service — backend processes, optionally not publicly routable",
          "Worker / Cron Job — background processing without an HTTP port",
          "Docker Service — any Dockerfile, the universal fallback for unsupported stacks",
          "Postgres / MySQL / MariaDB / Redis / Object Storage — managed infrastructure services",
        ],
      },
      {
        id: "commands",
        heading: "Root directory, build, and start commands",
        paragraphs: ["For monorepos, set Root Directory to the service's subfolder. Build Command and Start Command are auto-detected from your framework but can be overridden per service — for example npm run build and npm start."],
      },
      {
        id: "resources",
        heading: "Resource presets",
        paragraphs: ["Every service is sized from one of four presets:"],
        table: {
          headers: ["Preset", "CPU", "RAM", "Disk", "Est. cost"],
          rows: [
            ["Nano", "0.25 cores", "256 MB", "1 GB", "$2/mo"],
            ["Starter", "0.5 cores", "512 MB", "2 GB", "$5/mo"],
            ["Developer", "1 core", "1024 MB", "4 GB", "$10/mo"],
            ["Pro", "2 cores", "4096 MB", "8 GB", "$25/mo"],
          ],
        },
      },
      {
        id: "autoscaling",
        heading: "Autoscaling",
        paragraphs: ["A service can define a minimum and maximum instance count, plus CPU/memory/request-rate thresholds. Scaling up reacts to any breached signal; scaling down requires every signal to stay below half its threshold, which prevents oscillation. Separate cooldowns for scale-up and scale-down stop rapid flapping."],
      },
    ],
  },
  {
    slug: "databases",
    title: "Databases",
    icon: Database,
    description: "Managed PostgreSQL, MySQL, and MariaDB — provisioning, the SQL editor, backups, and access control.",
    sections: [
      {
        id: "engines",
        heading: "Supported engines",
        paragraphs: [
          "PostgreSQL is fully real: creating a database provisions an actual, isolated Postgres role and database on the platform's Postgres server. Isolation is enforced by Postgres itself — a tenant's role can only ever see its own database.",
          "MySQL and MariaDB are represented in the schema and API but provisioning against a real MySQL server isn't wired up yet in this environment.",
        ],
        callout: { tone: "info", text: "If you need MySQL/MariaDB today, use a Docker service with your own database image instead." },
      },
      {
        id: "sql-editor",
        heading: "SQL editor & table browser",
        paragraphs: ["Every query in the SQL editor runs through a connection pool authenticated as your own database's role — never a shared admin connection. Browse tables, inspect columns, and page through rows without writing SQL."],
      },
      {
        id: "backups",
        heading: "Backups",
        paragraphs: ["Trigger a manual backup any time, or rely on the automatic daily backup schedule. Restoring overwrites the current database contents with the selected backup — this can't be undone."],
      },
      {
        id: "users",
        heading: "Database users",
        paragraphs: ["Create additional, scoped Postgres roles for things like a read-only analytics connection — separate from the database's own owner role. The generated password is shown once."],
      },
      {
        id: "connections",
        heading: "Live connections & metrics",
        paragraphs: ["The Connections tab reads directly from pg_stat_activity, so it always reflects who's connected right now. Active connection count and on-disk storage size are live, not cached snapshots."],
      },
    ],
  },
  {
    slug: "storage",
    title: "Storage",
    icon: HardDrive,
    description: "S3-compatible object storage for files, media, and backups.",
    sections: [
      {
        id: "buckets",
        heading: "Buckets",
        paragraphs: ["Create a bucket per use case — uploads, backups, exports. Each bucket can be public (objects are readable by URL) or private."],
      },
      {
        id: "files",
        heading: "Files and folders",
        paragraphs: ["Upload files directly from the dashboard, organize them into folders, and get a signed, time-limited URL for any private object without making the whole bucket public."],
      },
    ],
  },
  {
    slug: "domains",
    title: "Domains",
    icon: Globe2,
    description: "Platform subdomains, custom domains, DNS verification, and automatic SSL.",
    sections: [
      {
        id: "platform-domain",
        heading: "Platform domain",
        paragraphs: ["Every project gets a free subdomain automatically — <your-slug>.clouddeploy.app — with SSL already active, no setup required."],
      },
      {
        id: "custom-domain",
        heading: "Connecting a custom domain",
        paragraphs: ["Add your domain and CloudDeploy generates the exact DNS records to create at your registrar:"],
        table: {
          headers: ["Type", "Name", "Purpose"],
          rows: [
            ["A", "@", "Points your root domain at the platform's ingress"],
            ["CNAME", "www", "Points the www subdomain at your root domain"],
            ["TXT", "_clouddeploy-verify.<domain>", "Proves you control the domain"],
          ],
        },
        callout: { tone: "info", text: "DNS changes can take a few minutes to a few hours to propagate. Use the Verify button once you've added the records — no need to wait blindly." },
      },
      {
        id: "ssl",
        heading: "SSL",
        paragraphs: ["Once a domain verifies, CloudDeploy automatically issues a Let's Encrypt certificate and renews it before expiry. Platform subdomains are covered by SSL from the moment your project is created."],
      },
    ],
  },
  {
    slug: "environment-variables",
    title: "Environment Variables",
    icon: Braces,
    description: "Configuration and secrets, scoped per service and environment.",
    sections: [
      {
        id: "basics",
        heading: "Setting variables",
        paragraphs: ["Environment variables are set per service and per environment (Production or Preview), and are injected into the container at deploy time. Mark a variable as Secret to keep its value encrypted at rest and masked in the dashboard until explicitly revealed."],
      },
      {
        id: "bulk-import",
        heading: "Bulk import",
        paragraphs: ["Paste the contents of an existing .env file to create multiple variables at once instead of adding them one at a time."],
      },
    ],
  },
  {
    slug: "monitoring",
    title: "Monitoring",
    icon: BarChart3,
    description: "Live database metrics and threshold alert rules.",
    sections: [
      {
        id: "alerts",
        heading: "Alert rules",
        paragraphs: ["Create a rule against a database's connection count or storage percentage, choose above/below and a threshold, and CloudDeploy evaluates it every 60 seconds against real, live values. A cooldown period stops the same rule from re-firing repeatedly once it's already triggered."],
      },
      {
        id: "limits",
        heading: "What's not covered yet",
        paragraphs: ["Per-service CPU/RAM charts need a real metrics collector sampling running application containers, which isn't wired up in this environment yet. Database connection count and storage are already fully live."],
      },
    ],
  },
  {
    slug: "billing",
    title: "Billing",
    icon: CreditCard,
    description: "Plans, usage limits, and how upgrades work.",
    sections: [
      {
        id: "plans",
        heading: "Plans",
        paragraphs: ["CloudDeploy has five plans — Free, Developer, Pro, Business, and Enterprise — each with its own project count, RAM, database, storage, and team-member limits. See the full breakdown on the Pricing page, which reflects live plan data."],
      },
      {
        id: "cycle",
        heading: "Billing cycle",
        paragraphs: ["Plans can be billed monthly or yearly (yearly is discounted). Upgrading or downgrading takes effect through your billing settings; invoices and payment methods are managed there too."],
      },
    ],
  },
  {
    slug: "api",
    title: "API",
    icon: Workflow,
    description: "The versioned public REST API — authentication, rate limits, and webhooks.",
    sections: [
      {
        id: "basics",
        heading: "Base path & versioning",
        paragraphs: ["Every endpoint is versioned under /api/v1. Two authentication modes are supported: a user session (JWT, used by the dashboard) or an API key passed as a bearer token."],
        code: { code: "curl https://api.clouddeploy.app/api/v1/projects \\\n  -H \"Authorization: Bearer cd_<prefix>_<secret>\"" },
      },
      {
        id: "keys",
        heading: "API keys & permission scopes",
        paragraphs: ["Each API key is created with an explicit set of permission scopes, checked on every request:"],
        list: ["projects:read / projects:write", "deployments:read / deployments:write", "logs:read", "databases:read / databases:write", "domains:read / domains:write", "billing:read"],
      },
      {
        id: "rate-limits",
        heading: "Rate limits",
        paragraphs: ["Rate limits are enforced per API key, per minute, based on your organization's plan — and shared correctly across every API instance, not per-process."],
        table: {
          headers: ["Plan", "Requests / minute"],
          rows: [["Free", "60"], ["Developer", "120"], ["Pro", "300"], ["Business", "1,000"], ["Enterprise", "5,000"]],
        },
      },
      {
        id: "webhooks",
        heading: "Webhooks",
        paragraphs: ["Subscribe an endpoint to real platform events instead of polling the API:"],
        list: ["deployment.started", "deployment.success", "deployment.failed", "service.restarted", "database.backup.completed", "database.backup.failed", "alert.triggered"],
      },
    ],
  },
  {
    slug: "cli",
    title: "CLI",
    icon: Terminal,
    description: "Command-line reference for @clouddeploy/cli.",
    sections: [
      {
        id: "auth",
        heading: "Authentication",
        paragraphs: ["The CLI stores its session at ~/.config/clouddeploy/config.json after you log in with an API key."],
        code: { code: "clouddeploy login --api-key <key> [--base-url <url>] [--organization <id>]\nclouddeploy whoami" },
      },
      {
        id: "projects",
        heading: "Projects & deployment",
        code: { code: "clouddeploy init                       # scaffold clouddeploy.json in the current directory\nclouddeploy projects                   # list your projects\nclouddeploy deploy --project <id> [--service <id>] [--branch <name>]\nclouddeploy rollback <deployment-id> --target <deployment-id>" },
      },
      {
        id: "logs",
        heading: "Logs",
        code: { code: "clouddeploy logs <deployment-id>            # print current logs\nclouddeploy logs <deployment-id> --follow   # stream logs live" },
      },
      {
        id: "env",
        heading: "Environment variables",
        code: { code: "clouddeploy env list --project <id>\nclouddeploy env set KEY VALUE --project <id> [--service <id>] [--public]" },
      },
      {
        id: "reference",
        heading: "Everything else",
        paragraphs: ["domains and database subcommands manage domains and databases the same way the dashboard does — run clouddeploy help for the full, current list."],
      },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    icon: CircleHelp,
    description: "Fixes for the problems that come up most.",
    sections: [
      {
        id: "build-fails",
        heading: "A build fails immediately",
        paragraphs: ["Check that Root Directory matches where your package.json actually lives (especially in a monorepo), and that Build Command / Start Command are correct for your framework. The Logs tab shows exactly which step failed."],
      },
      {
        id: "missing-database-url",
        heading: "\"DATABASE_URL missing\" at runtime",
        paragraphs: ["Your service is trying to connect to a database that isn't attached. Create or attach a database from the Databases tab, confirm the environment variable was injected, then redeploy."],
      },
      {
        id: "domain-pending",
        heading: "A domain is stuck on \"Pending\"",
        paragraphs: ["This means CloudDeploy hasn't yet seen the DNS records it asked for. Double-check the A/CNAME/TXT records match exactly what's shown on the domain's page, then click Verify — DNS propagation can take a few minutes to a few hours."],
      },
      {
        id: "api-401",
        heading: "API requests return 401 or 403",
        paragraphs: ["401 means the key is missing, malformed, or revoked. 403 means the key is valid but lacks the permission scope that route requires — check the scopes the key was created with."],
      },
    ],
  },
];

export function findDocPage(slug: string): DocPage | undefined {
  return DOCS_PAGES.find((p) => p.slug === slug);
}

/** The getting-started guide is canonically served at /docs itself rather
 * than /docs/getting-started, so every link into it (nav, search, quick
 * links) should agree on the same URL instead of creating a duplicate. */
export function docHref(slug: string, sectionId?: string): string {
  const base = slug === "getting-started" ? "/docs" : `/docs/${slug}`;
  return sectionId ? `${base}#${sectionId}` : base;
}
