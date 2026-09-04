import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

const SAFE_USERNAME = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * Provisions logically-isolated Redis "instances" on the one shared Redis
 * server using Redis 6+ ACL users: each tenant gets a dedicated ACL user
 * whose command/keyspace permissions are restricted to keys under its own
 * `<username>:` prefix (`~<username>:*`). Redis enforces this natively at
 * the ACL layer — a connection authenticated as one tenant's user cannot
 * read or write another tenant's keys, even though they share one server
 * process. This mirrors the same "one shared server, real per-tenant
 * isolation" approach used for Postgres (see PostgresAdminService) and
 * matches the MVP fidelity level called for in section 6 of the product
 * spec; a dedicated Redis instance per tenant is future, Kubernetes-ready
 * architecture, not an MVP requirement.
 */
@Injectable()
export class RedisAdminService {
  private readonly logger = new Logger("RedisAdminService");
  private adminClient: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  private getAdminClient(): Redis {
    if (!this.adminClient) {
      this.adminClient = new Redis(this.config.getOrThrow<string>("REDIS_URL"));
    }
    return this.adminClient;
  }

  async createTenantUser(username: string, password: string): Promise<void> {
    if (!SAFE_USERNAME.test(username)) throw new Error(`Unsafe Redis ACL username: ${username}`);
    const client = this.getAdminClient();
    await client.call(
      "ACL",
      "SETUSER",
      username,
      "on",
      `>${password}`,
      "~" + `${username}:*`,
      "+@all",
      "-@dangerous",
    );
    this.logger.log(`Provisioned Redis ACL user "${username}" scoped to keyspace "${username}:*"`);
  }

  async rotatePassword(username: string, newPassword: string): Promise<void> {
    if (!SAFE_USERNAME.test(username)) throw new Error(`Unsafe Redis ACL username: ${username}`);
    const client = this.getAdminClient();
    await client.call("ACL", "SETUSER", username, "resetpass", `>${newPassword}`);
  }

  async deleteTenantUser(username: string): Promise<void> {
    if (!SAFE_USERNAME.test(username)) throw new Error(`Unsafe Redis ACL username: ${username}`);
    const client = this.getAdminClient();
    await client.call("ACL", "DELUSER", username).catch(() => undefined);
  }

  async ping(): Promise<boolean> {
    const client = this.getAdminClient();
    return (await client.ping()) === "PONG";
  }
}
