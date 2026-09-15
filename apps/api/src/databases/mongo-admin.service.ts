import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execInContainer } from "@clouddeploy/docker";

const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

function assertSafeIdentifier(value: string, label: string): void {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Unsafe ${label} identifier: ${value}`);
  }
}

/**
 * Provisions real MongoDB databases + users on the shared `mongo` container
 * (infra/docker/docker-compose.yml), same one-server-many-databases fidelity
 * as PostgresAdminService / MysqlAdminService. Auth is on; each tenant gets
 * a user whose roles are scoped to that one database.
 */
@Injectable()
export class MongoAdminService {
  private readonly logger = new Logger("MongoAdminService");

  constructor(private readonly config: ConfigService) {}

  private container(): string {
    return this.config.get<string>("MONGO_CONTAINER_NAME") ?? "clouddeploy-mongo-1";
  }

  async createTenantDatabase(databaseName: string, username: string, password: string): Promise<void> {
    assertSafeIdentifier(databaseName, "database name");
    assertSafeIdentifier(username, "user name");
    const js = `
      const dbn = ${JSON.stringify(databaseName)};
      const user = ${JSON.stringify(username)};
      const pwd = ${JSON.stringify(password)};
      const testdb = db.getSiblingDB(dbn);
      testdb.createCollection("_clouddeploy");
      db.getSiblingDB("admin").createUser({
        user,
        pwd,
        roles: [
          { role: "readWrite", db: dbn },
          { role: "dbAdmin", db: dbn }
        ]
      });
    `;
    await this.eval(js);
    this.logger.log(`Provisioned tenant MongoDB "${databaseName}" owned by user "${username}"`);
  }

  async dropTenantDatabase(databaseName: string, username: string): Promise<void> {
    assertSafeIdentifier(databaseName, "database name");
    assertSafeIdentifier(username, "user name");
    const js = `
      db.getSiblingDB(${JSON.stringify(databaseName)}).dropDatabase();
      try { db.getSiblingDB("admin").dropUser(${JSON.stringify(username)}); } catch (e) {}
    `;
    await this.eval(js);
  }

  async rotateTenantPassword(username: string, newPassword: string): Promise<void> {
    assertSafeIdentifier(username, "user name");
    const js = `
      db.getSiblingDB("admin").changeUserPassword(${JSON.stringify(username)}, ${JSON.stringify(newPassword)});
    `;
    await this.eval(js);
  }

  async createScopedUser(databaseName: string, username: string, password: string, access: "readonly" | "readwrite"): Promise<void> {
    assertSafeIdentifier(databaseName, "database name");
    assertSafeIdentifier(username, "user name");
    const role = access === "readwrite" ? "readWrite" : "read";
    const js = `
      db.getSiblingDB("admin").createUser({
        user: ${JSON.stringify(username)},
        pwd: ${JSON.stringify(password)},
        roles: [{ role: ${JSON.stringify(role)}, db: ${JSON.stringify(databaseName)} }]
      });
    `;
    await this.eval(js);
  }

  async dropScopedUser(username: string): Promise<void> {
    assertSafeIdentifier(username, "user name");
    const js = `try { db.getSiblingDB("admin").dropUser(${JSON.stringify(username)}); } catch (e) {}`;
    await this.eval(js);
  }

  async listCollections(databaseName: string, username: string, password: string): Promise<string[]> {
    assertSafeIdentifier(databaseName, "database name");
    const result = await execInContainer(this.container(), [
      "mongosh",
      "--quiet",
      "-u",
      username,
      "-p",
      password,
      "--authenticationDatabase",
      "admin",
      databaseName,
      "--eval",
      "JSON.stringify(db.getCollectionNames())",
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`mongosh failed: ${result.stderr.slice(0, 1000)}`);
    }
    const parsed = JSON.parse(result.stdout.toString("utf8").trim()) as string[];
    return parsed.filter((name) => name !== "_clouddeploy");
  }

  async dumpDatabase(databaseName: string): Promise<Buffer> {
    assertSafeIdentifier(databaseName, "database name");
    const result = await execInContainer(this.container(), [
      "mongodump",
      "-u",
      "clouddeploy",
      "-p",
      "clouddeploy",
      "--authenticationDatabase",
      "admin",
      "--db",
      databaseName,
      "--archive",
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`mongodump failed: ${result.stderr.slice(0, 2000)}`);
    }
    return result.stdout;
  }

  async restoreDatabase(databaseName: string, archive: Buffer): Promise<void> {
    assertSafeIdentifier(databaseName, "database name");
    const result = await execInContainer(
      this.container(),
      [
        "mongorestore",
        "-u",
        "clouddeploy",
        "-p",
        "clouddeploy",
        "--authenticationDatabase",
        "admin",
        "--db",
        databaseName,
        "--archive",
        "--drop",
      ],
      { stdin: archive },
    );
    if (result.exitCode !== 0) {
      throw new Error(`mongorestore failed: ${result.stderr.slice(0, 2000)}`);
    }
  }

  private async eval(javascript: string): Promise<void> {
    const result = await execInContainer(this.container(), [
      "mongosh",
      "--quiet",
      "-u",
      "clouddeploy",
      "-p",
      "clouddeploy",
      "--authenticationDatabase",
      "admin",
      "--eval",
      javascript,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`mongosh failed: ${result.stderr.slice(0, 2000) || result.stdout.toString("utf8").slice(0, 2000)}`);
    }
  }
}
