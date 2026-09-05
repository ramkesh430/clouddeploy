#!/usr/bin/env node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CloudDeploy, CloudDeployError } from "@clouddeploy/sdk";

interface Config { apiKey: string; baseUrl?: string; organizationId?: string }
const CONFIG_DIR = path.join(os.homedir(), ".config", "clouddeploy");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function flag(name: string) { const index = process.argv.indexOf(`--${name}`); return index >= 0 ? process.argv[index + 1] : undefined; }
function positional(index: number) { return process.argv.slice(2).filter((arg, argIndex, all) => !arg.startsWith("--") && (argIndex === 0 || !all[argIndex - 1]?.startsWith("--")))[index]; }
async function readConfig(): Promise<Config> { try { return JSON.parse(await fs.readFile(CONFIG_FILE, "utf8")) as Config; } catch { throw new Error("Not logged in. Run clouddeploy login --api-key <key>."); } }
async function writeConfig(config: Config) { await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 }); await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 }); }
function output(value: unknown) { process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`); }

async function main() {
  const command = positional(0);
  if (!command || ["help", "--help", "-h"].includes(command)) return output("CloudDeploy CLI\n\nlogin, whoami, init, projects, deploy, logs, env list|set, domains, database, rollback");

  if (command === "login") {
    const apiKey = flag("api-key");
    if (!apiKey) throw new Error("Use clouddeploy login --api-key <key> [--base-url <url>] [--organization <id>]");
    const config = { apiKey, baseUrl: flag("base-url"), organizationId: flag("organization") };
    const client = new CloudDeploy(config);
    const me = await client.whoami<{ email: string; organizations?: Array<{ id: string }> }>();
    if (!config.organizationId) config.organizationId = me.organizations?.[0]?.id;
    await writeConfig(config);
    return output(`Authenticated as ${me.email}`);
  }

  const config = await readConfig();
  const client = new CloudDeploy(config);
  const organizationId = flag("organization") ?? config.organizationId;

  if (command === "whoami") return output(await client.whoami());
  if (command === "init") {
    const project = { name: flag("name") ?? path.basename(process.cwd()), organizationId, region: flag("region") ?? "us-east" };
    await fs.writeFile(path.join(process.cwd(), "clouddeploy.json"), JSON.stringify(project, null, 2));
    return output("Created clouddeploy.json");
  }
  if (command === "projects") { if (!organizationId) throw new Error("Set --organization or log in with a default organization."); return output(await client.projects.list(organizationId)); }
  if (command === "deploy") { const projectId = flag("project") ?? positional(1); if (!projectId) throw new Error("Use clouddeploy deploy --project <id>"); return output(await client.deployments.create({ projectId, serviceId: flag("service"), branch: flag("branch") })); }
  if (command === "logs") {
    const deploymentId = positional(1); if (!deploymentId) throw new Error("Use clouddeploy logs <deployment-id>");
    if (!process.argv.includes("--follow")) return output(await client.logs.list(deploymentId));
    for await (const entry of client.logs.stream(deploymentId)) output(`${entry.timestamp} ${entry.level.padEnd(5)} ${entry.message}`);
    return;
  }
  if (command === "env") {
    const subcommand = positional(1); const projectId = flag("project"); if (!projectId) throw new Error("Use --project <id>");
    if (subcommand === "list") return output(await client.env.list(projectId, flag("service")));
    if (subcommand === "set") { const key = positional(2); const value = positional(3); if (!key || value === undefined) throw new Error("Use clouddeploy env set KEY VALUE --project <id>"); return output(await client.env.set({ projectId, serviceId: flag("service"), key, value, isSecret: !process.argv.includes("--public") })); }
  }
  if (command === "domains") { if (!organizationId) throw new Error("Organization is required"); return output(await client.domains.list(organizationId)); }
  if (command === "database") { if (!organizationId) throw new Error("Organization is required"); const subcommand = positional(1) ?? "list"; if (subcommand === "list") return output(await client.database.list(organizationId)); if (subcommand === "create") return output(await client.database.create({ organizationId, name: flag("name") ?? "database", engine: (flag("engine") as "POSTGRESQL" | "MYSQL" | "MARIADB") ?? "POSTGRESQL", region: flag("region") })); }
  if (command === "rollback") { const deploymentId = positional(1); const target = flag("target"); if (!deploymentId || !target) throw new Error("Use clouddeploy rollback <deployment-id> --target <deployment-id>"); return output(await client.deployments.rollback(deploymentId, target)); }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  const message = error instanceof CloudDeployError ? `${error.status} ${error.code}: ${error.message}` : (error as Error).message;
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
