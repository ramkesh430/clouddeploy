import {
  dockerRunArgs,
  evaluateImagePolicy,
  generateRuntimeDockerfile,
  parseTrivyCriticalCount,
  signImageDigest,
  traefikTlsRouterSnapshot,
  verifyImageSignature,
  CONTAINER_ID_LABEL,
} from "./sandbox";

describe("sandbox docker run args", () => {
  const args = dockerRunArgs({
    name: "cd-svc-1",
    image: "sha256:abc123def4567890",
    cpuCores: 0.5,
    ramMb: 512,
    env: { PORT: "3000" },
    port: 3000,
    network: "clouddeploy_default",
    platformContainerId: "cntr_1",
    serviceId: "svc_1",
    projectId: "proj_1",
  });

  it("drops all capabilities and disables privilege escalation", () => {
    expect(args).toContain("--cap-drop");
    expect(args).toContain("ALL");
    expect(args).toContain("no-new-privileges:true");
    expect(args).toContain("--pids-limit");
  });

  it("labels the container with the platform Container.id", () => {
    expect(args).toContain(`${CONTAINER_ID_LABEL}=cntr_1`);
    expect(args).toContain("com.clouddeploy.service-id=svc_1");
  });

  it("does not mount the docker socket", () => {
    expect(args.join(" ")).not.toContain("docker.sock");
  });
});

describe("generated runtime Dockerfile", () => {
  const file = generateRuntimeDockerfile("NODE", "npm install", "npm start", "npm run build", 3000);

  it("runs as a non-root user", () => {
    expect(file).toMatch(/^USER node$/m);
    expect(file).toContain("COPY --chown=node:node");
  });
});

describe("image signatures", () => {
  const digest = "sha256:0123456789abcdef0123456789abcdef";
  const key = "test-signing-key-must-be-long-enough";

  it("round-trips HMAC verification", () => {
    const sig = signImageDigest(digest, key);
    expect(verifyImageSignature(digest, sig, key)).toBe(true);
    expect(verifyImageSignature(digest, sig, "other-key-must-be-long-enough!!")).toBe(false);
    expect(verifyImageSignature("sha256:deadbeef", sig, key)).toBe(false);
  });
});

describe("image policy", () => {
  it("rejects root images and missing digests", () => {
    const root = evaluateImagePolicy({ user: "", digest: "latest" });
    expect(root.map((f) => f.code).sort()).toEqual(["MISSING_DIGEST", "RUNS_AS_ROOT"]);
    const ok = evaluateImagePolicy({ user: "node", digest: "sha256:0123456789abcdef" });
    expect(ok).toEqual([]);
  });
});

describe("trivy report parsing", () => {
  it("counts CRITICAL and HIGH findings", () => {
    const json = JSON.stringify({
      Results: [
        { Vulnerabilities: [{ Severity: "CRITICAL" }, { Severity: "HIGH" }, { Severity: "HIGH" }, { Severity: "MEDIUM" }] },
      ],
    });
    expect(parseTrivyCriticalCount(json)).toEqual({ critical: 1, high: 2 });
  });
});

describe("traefik TLS snapshot", () => {
  it("requests Let's Encrypt on the verified hostname", () => {
    const snap = traefikTlsRouterSnapshot({
      key: "domain-1",
      hostname: "app.example.com",
      backendUrl: "http://127.0.0.1:49152",
    });
    expect(snap.http.routers["domain-1"]!.tls).toEqual({ certResolver: "letsencrypt" });
    expect(snap.http.routers["domain-1"]!.rule).toBe("Host(`app.example.com`)");
  });
});
