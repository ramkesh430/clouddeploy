import { isSensitiveRepositoryPath, redactSecrets } from "./secret-redactor";

describe("AI secret redaction boundary", () => {
  it("excludes common secret-bearing repository files", () => {
    expect(isSensitiveRepositoryPath(".env.production")).toBe(true);
    expect(isSensitiveRepositoryPath("config/private.key")).toBe(true);
    expect(isSensitiveRepositoryPath("src/index.ts")).toBe(false);
  });

  it("removes credentials while keeping diagnostic structure", () => {
    const result = redactSecrets([
      "DATABASE_URL=postgresql://app:super-secret@db:5432/app",
      "Authorization: Bearer this-token-must-not-leave",
      "PORT=3000",
    ].join("\n"));

    expect(result.value).not.toContain("super-secret");
    expect(result.value).not.toContain("this-token-must-not-leave");
    expect(result.value).toContain("PORT=3000");
    expect(result.redactedCount).toBeGreaterThanOrEqual(2);
  });

  it("redacts an AWS access key ID hardcoded under a non-secret-looking name", () => {
    const result = redactSecrets('const key = "AKIAIOSFODNN7EXAMPLE"; require("express")()');
    expect(result.value).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(result.redactedCount).toBeGreaterThanOrEqual(1);
  });

  it("redacts a PEM private key block with no key=value shape", () => {
    const pem = ["-----BEGIN RSA PRIVATE KEY-----", "MIIEpAIBAAKCAQEA1234567890abcdef", "-----END RSA PRIVATE KEY-----"].join("\n");
    const result = redactSecrets(`const cert = \`${pem}\`;`);
    expect(result.value).not.toContain("MIIEpAIBAAKCAQEA1234567890abcdef");
    expect(result.redactedCount).toBeGreaterThanOrEqual(1);
  });
});
