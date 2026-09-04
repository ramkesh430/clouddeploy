import { detectRepositoryStack } from "./detection";

describe("detectRepositoryStack", () => {
  it("prefers a co-located backend manifest over a frontend-tooling package.json (Laravel + Vite)", () => {
    const result = detectRepositoryStack({
      repositoryFullName: "acme/laravel-app",
      defaultBranch: "main",
      allPaths: ["composer.json", "artisan", "package.json", "vite.config.js"],
      manifestContents: {
        "composer.json": JSON.stringify({ require: { "laravel/framework": "^11.0" } }),
        "package.json": JSON.stringify({ devDependencies: { vite: "^5.0.0" } }),
      },
    });

    expect(result.services).toHaveLength(1);
    expect(result.services[0]).toMatchObject({ runtime: "PHP", framework: "LARAVEL" });
    expect(result.database?.engine).toBe("MYSQL");
  });

  it("still surfaces a real Node app framework alongside another backend manifest", () => {
    const result = detectRepositoryStack({
      repositoryFullName: "acme/mixed",
      defaultBranch: "main",
      allPaths: ["go.mod", "package.json"],
      manifestContents: {
        "package.json": JSON.stringify({ dependencies: { next: "^14.0.0" }, scripts: { build: "next build", start: "next start" } }),
      },
    });

    const frameworks = result.services.map((s) => s.framework).sort();
    expect(frameworks).toEqual(["GO_GENERIC", "NEXTJS"]);
  });

  it("detects a monorepo with separate frontend and backend roots", () => {
    const result = detectRepositoryStack({
      repositoryFullName: "acme/shopfront",
      defaultBranch: "main",
      allPaths: ["frontend/package.json", "backend/package.json"],
      manifestContents: {
        "frontend/package.json": JSON.stringify({ dependencies: { next: "^14.0.0" }, scripts: { build: "next build", start: "next start" } }),
        "backend/package.json": JSON.stringify({ dependencies: { "@nestjs/core": "^10.0.0", pg: "^8.0.0" }, scripts: { "start:prod": "node dist/main" } }),
      },
    });

    expect(result.services).toHaveLength(2);
    const frontend = result.services.find((s) => s.rootDirectory === "frontend");
    const backend = result.services.find((s) => s.rootDirectory === "backend");
    expect(frontend).toMatchObject({ framework: "NEXTJS", type: "WEB_SERVICE" });
    expect(backend).toMatchObject({ framework: "NESTJS", type: "API_SERVICE" });
    expect(result.database?.engine).toBe("POSTGRESQL");
  });

  it("treats a root Dockerfile as the universal fallback, overriding other manifests", () => {
    const result = detectRepositoryStack({
      repositoryFullName: "acme/dockerized",
      defaultBranch: "main",
      allPaths: ["Dockerfile", "package.json", "requirements.txt"],
      manifestContents: {},
    });

    expect(result.usesDockerfile).toBe(true);
    expect(result.services).toHaveLength(1);
    expect(result.services[0]).toMatchObject({ type: "DOCKER_SERVICE", framework: "DOCKERFILE" });
  });

  it("ignores manifests nested more than one directory deep", () => {
    const result = detectRepositoryStack({
      repositoryFullName: "acme/deep",
      defaultBranch: "main",
      allPaths: ["node_modules/some-dep/package.json", "src/lib/nested/package.json"],
      manifestContents: {},
    });

    expect(result.services).toHaveLength(0);
  });
});
