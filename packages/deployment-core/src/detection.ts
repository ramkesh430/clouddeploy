import { Framework, Runtime, ServiceType } from "@clouddeploy/types";
import type {
  DetectedService,
  DetectedDatabaseRequirement,
  DetectedRedisRequirement,
  RepositoryDetectionResult,
} from "@clouddeploy/types";

/**
 * Pure repository-stack detector: given the full list of file paths in a
 * repository and the text content of every recognized manifest file, works
 * out what to deploy — mirroring section 8/9/20 of the product spec
 * (automatic runtime detection with Docker as the universal fallback).
 *
 * Deliberately has no I/O of its own. The caller (GithubApiService) does
 * the network work — fetching the git tree and the manifest file contents
 * — so this function can be unit-tested with plain fixtures.
 */
export interface DetectionInput {
  repositoryFullName: string;
  defaultBranch: string;
  /** Every file path in the repository (from a recursive git tree listing). */
  allPaths: string[];
  /** path -> raw text content, for every manifest file discovered among allPaths. */
  manifestContents: Record<string, string>;
}

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string };
}

const NODE_FRAMEWORK_DEP_MAP: Array<{ dep: string; framework: Framework; type: ServiceType; port: number }> = [
  { dep: "next", framework: Framework.NEXTJS, type: ServiceType.WEB_SERVICE, port: 3000 },
  { dep: "nuxt", framework: Framework.NUXT, type: ServiceType.WEB_SERVICE, port: 3000 },
  { dep: "@angular/core", framework: Framework.ANGULAR, type: ServiceType.STATIC_SITE, port: 4200 },
  { dep: "@remix-run/dev", framework: Framework.REMIX, type: ServiceType.WEB_SERVICE, port: 3000 },
  { dep: "astro", framework: Framework.ASTRO, type: ServiceType.STATIC_SITE, port: 4321 },
  { dep: "@nestjs/core", framework: Framework.NESTJS, type: ServiceType.API_SERVICE, port: 3000 },
  { dep: "vue", framework: Framework.VUE, type: ServiceType.STATIC_SITE, port: 5173 },
  { dep: "vite", framework: Framework.VITE, type: ServiceType.STATIC_SITE, port: 5173 },
  { dep: "express", framework: Framework.EXPRESS, type: ServiceType.API_SERVICE, port: 3000 },
  { dep: "react", framework: Framework.REACT, type: ServiceType.STATIC_SITE, port: 3000 },
];

const DB_DEP_SIGNALS: Record<string, "POSTGRESQL" | "MYSQL"> = {
  pg: "POSTGRESQL",
  postgres: "POSTGRESQL",
  "@prisma/client": "POSTGRESQL",
  prisma: "POSTGRESQL",
  typeorm: "POSTGRESQL",
  sequelize: "POSTGRESQL",
  psycopg2: "POSTGRESQL",
  "psycopg2-binary": "POSTGRESQL",
  asyncpg: "POSTGRESQL",
  django: "POSTGRESQL",
  mysql: "MYSQL",
  mysql2: "MYSQL",
  pymysql: "MYSQL",
};

const REDIS_DEP_SIGNALS = ["redis", "ioredis", "django-redis", "celery", "bullmq", "bull"];

function baseName(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
}

function dirName(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Marker filenames that, when found, identify a directory as a deployable root. */
const MANIFEST_FILENAMES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "composer.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "go.mod",
  "Gemfile",
  "Cargo.toml",
  "Dockerfile",
];

export function detectRepositoryStack(input: DetectionInput): RepositoryDetectionResult {
  const { allPaths, manifestContents } = input;

  // Group every manifest file by the directory it lives in — the repo root
  // ("") plus any subdirectory that has its own manifest (covers monorepos
  // like /frontend + /backend).
  const rootsByDir = new Map<string, Set<string>>();
  for (const path of allPaths) {
    const name = baseName(path);
    if (!MANIFEST_FILENAMES.includes(name)) continue;
    const dir = dirName(path);
    // Only treat depth 0 (root) and depth 1 directories as service roots —
    // deeper nesting is almost always a dependency's own manifest, not ours.
    if (dir.includes("/")) continue;
    if (!rootsByDir.has(dir)) rootsByDir.set(dir, new Set());
    rootsByDir.get(dir)!.add(name);
  }

  const services: DetectedService[] = [];
  let database: DetectedDatabaseRequirement | null = null;
  let redis: DetectedRedisRequirement | null = null;
  let usesDockerfile = false;

  const dbSignals = new Set<string>();
  const redisSignals = new Set<string>();

  for (const [dir, manifestNames] of rootsByDir) {
    const rootLabel = dir === "" ? "root" : dir;
    const joinPath = (name: string) => (dir === "" ? name : `${dir}/${name}`);
    const servicesBeforeThisDir = services.length;

    // Docker is the universal fallback: a Dockerfile at this root wins
    // outright over any other manifest detected in the same directory.
    if (manifestNames.has("Dockerfile")) {
      usesDockerfile = true;
      services.push({
        name: dir === "" ? "app" : dir,
        type: ServiceType.DOCKER_SERVICE,
        runtime: Runtime.DOCKER,
        framework: Framework.DOCKERFILE,
        rootDirectory: dir === "" ? "." : dir,
        buildCommand: null,
        startCommand: null,
        installCommand: null,
        port: null,
        runtimeVersion: null,
        confidence: 0.95,
      });
      continue;
    }

    if (manifestNames.has("requirements.txt") || manifestNames.has("pyproject.toml") || manifestNames.has("Pipfile")) {
      const reqContent =
        manifestContents[joinPath("requirements.txt")] ??
        manifestContents[joinPath("pyproject.toml")] ??
        manifestContents[joinPath("Pipfile")] ??
        "";
      const lower = reqContent.toLowerCase();
      const hasManagePy = allPaths.includes(joinPath("manage.py"));

      for (const sig of Object.keys(DB_DEP_SIGNALS)) {
        if (lower.includes(sig)) dbSignals.add(DB_DEP_SIGNALS[sig]!);
      }
      for (const sig of REDIS_DEP_SIGNALS) {
        if (lower.includes(sig)) redisSignals.add(sig);
      }

      let framework: Framework = Framework.UNKNOWN;
      let startCommand: string | null = null;
      let port = 8000;
      if (hasManagePy || lower.includes("django")) {
        framework = Framework.DJANGO;
        startCommand = "python manage.py runserver 0.0.0.0:8000";
        dbSignals.add("POSTGRESQL");
      } else if (lower.includes("fastapi")) {
        framework = Framework.FASTAPI;
        startCommand = "uvicorn main:app --host 0.0.0.0 --port 8000";
      } else if (lower.includes("flask")) {
        framework = Framework.FLASK;
        startCommand = "flask run --host=0.0.0.0";
      }

      services.push({
        name: rootLabel === "root" ? "backend" : rootLabel,
        type: ServiceType.API_SERVICE,
        runtime: Runtime.PYTHON,
        framework,
        rootDirectory: dir === "" ? "." : dir,
        buildCommand: null,
        startCommand,
        installCommand: manifestNames.has("requirements.txt") ? "pip install -r requirements.txt" : "pip install .",
        port,
        runtimeVersion: null,
        confidence: framework === Framework.UNKNOWN ? 0.5 : 0.85,
      });
    }

    if (manifestNames.has("composer.json")) {
      const hasArtisan = allPaths.includes(joinPath("artisan"));
      services.push({
        name: rootLabel === "root" ? "backend" : rootLabel,
        type: ServiceType.API_SERVICE,
        runtime: Runtime.PHP,
        framework: hasArtisan ? Framework.LARAVEL : Framework.PHP_GENERIC,
        rootDirectory: dir === "" ? "." : dir,
        buildCommand: "composer install --no-dev --optimize-autoloader",
        startCommand: hasArtisan ? "php artisan serve --host=0.0.0.0 --port=8000" : "php -S 0.0.0.0:8000",
        installCommand: "composer install",
        port: 8000,
        runtimeVersion: null,
        confidence: hasArtisan ? 0.9 : 0.6,
      });
      if (hasArtisan) dbSignals.add("MYSQL");
    }

    if (manifestNames.has("pom.xml") || manifestNames.has("build.gradle") || manifestNames.has("build.gradle.kts")) {
      services.push({
        name: rootLabel === "root" ? "backend" : rootLabel,
        type: ServiceType.API_SERVICE,
        runtime: Runtime.JAVA,
        framework: Framework.SPRING_BOOT,
        rootDirectory: dir === "" ? "." : dir,
        buildCommand: manifestNames.has("pom.xml") ? "mvn clean package -DskipTests" : "./gradlew build -x test",
        startCommand: manifestNames.has("pom.xml") ? "java -jar target/*.jar" : "java -jar build/libs/*.jar",
        installCommand: null,
        port: 8080,
        runtimeVersion: null,
        confidence: 0.75,
      });
    }

    if (manifestNames.has("go.mod")) {
      services.push({
        name: rootLabel === "root" ? "backend" : rootLabel,
        type: ServiceType.API_SERVICE,
        runtime: Runtime.GO,
        framework: Framework.GO_GENERIC,
        rootDirectory: dir === "" ? "." : dir,
        buildCommand: "go build -o app .",
        startCommand: "./app",
        installCommand: "go mod download",
        port: 8080,
        runtimeVersion: null,
        confidence: 0.8,
      });
    }

    if (manifestNames.has("Gemfile")) {
      const gemContent = manifestContents[joinPath("Gemfile")] ?? "";
      const isRails = gemContent.toLowerCase().includes("rails");
      services.push({
        name: rootLabel === "root" ? "backend" : rootLabel,
        type: ServiceType.API_SERVICE,
        runtime: Runtime.RUBY,
        framework: isRails ? Framework.RAILS : Framework.RUBY_GENERIC,
        rootDirectory: dir === "" ? "." : dir,
        buildCommand: "bundle install",
        startCommand: isRails ? "bundle exec rails server -b 0.0.0.0" : "bundle exec ruby app.rb",
        installCommand: "bundle install",
        port: 3000,
        runtimeVersion: null,
        confidence: isRails ? 0.85 : 0.6,
      });
      if (isRails) dbSignals.add("POSTGRESQL");
    }

    if (manifestNames.has("Cargo.toml")) {
      services.push({
        name: rootLabel === "root" ? "backend" : rootLabel,
        type: ServiceType.API_SERVICE,
        runtime: Runtime.RUST,
        framework: Framework.RUST_GENERIC,
        rootDirectory: dir === "" ? "." : dir,
        buildCommand: "cargo build --release",
        startCommand: "./target/release/app",
        installCommand: null,
        port: 8080,
        runtimeVersion: null,
        confidence: 0.7,
      });
    }

    // package.json is checked last and deliberately lower priority than any
    // other backend manifest in the same directory: when a Laravel/Django/
    // Rails-style app has a package.json purely for its frontend asset
    // pipeline (Vite, webpack, esbuild...), that isn't a separately
    // deployable service. It's only surfaced here if either nothing else
    // claimed this directory, or it names a real app framework (Next.js,
    // NestJS, Express, etc.) rather than just a bundler.
    if (manifestNames.has("package.json")) {
      const content = manifestContents[joinPath("package.json")];
      const pkg = content ? safeJsonParse<PackageJson>(content) : null;
      const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
      const depNames = Object.keys(deps);

      for (const sig of depNames) {
        if (DB_DEP_SIGNALS[sig.toLowerCase()]) dbSignals.add(DB_DEP_SIGNALS[sig.toLowerCase()]!);
        if (REDIS_DEP_SIGNALS.includes(sig.toLowerCase())) redisSignals.add(sig);
      }

      const match = NODE_FRAMEWORK_DEP_MAP.find((m) => depNames.includes(m.dep));
      const wasClaimedByAnotherManifest = services.length > servicesBeforeThisDir;
      // Vite alone is ambiguous — it's as likely to be a backend framework's
      // asset-bundling step (Laravel, Django+Vite, Rails+vite_rails...) as a
      // real standalone frontend app, so it doesn't justify a second service
      // when something else already claimed this directory; every other
      // mapped framework (Next.js, NestJS, Express...) does.
      const isRealAppFramework = match && match.dep !== "vite";

      if (!wasClaimedByAnotherManifest || isRealAppFramework) {
        const scripts = pkg?.scripts ?? {};
        const buildCommand = scripts.build ? "npm run build" : null;
        const startScript = scripts["start:prod"] ? "start:prod" : scripts.start ? "start" : scripts.dev ? "dev" : null;
        const startCommand = startScript ? `npm run ${startScript}` : null;

        services.push({
          name: match ? (match.type === ServiceType.API_SERVICE ? "backend" : "frontend") : rootLabel,
          type: match?.type ?? ServiceType.WEB_SERVICE,
          runtime: Runtime.NODE,
          framework: match?.framework ?? Framework.UNKNOWN,
          rootDirectory: dir === "" ? "." : dir,
          buildCommand,
          startCommand: startCommand ?? (buildCommand ? null : "npm start"),
          installCommand: "npm install",
          port: match?.port ?? null,
          runtimeVersion: pkg?.engines?.node ?? null,
          confidence: match ? 0.9 : 0.55,
        });
      }
    }
  }

  if (dbSignals.size > 0) {
    const engine = dbSignals.has("POSTGRESQL") ? "POSTGRESQL" : "MYSQL";
    database = { engine, reason: `Detected ${Array.from(dbSignals).join(", ")}-compatible dependencies` };
  }
  if (redisSignals.size > 0) {
    redis = { reason: `Detected dependency: ${Array.from(redisSignals).join(", ")}` };
  }

  return {
    repositoryFullName: input.repositoryFullName,
    defaultBranch: input.defaultBranch,
    services,
    database,
    redis,
    usesDockerfile,
  };
}
