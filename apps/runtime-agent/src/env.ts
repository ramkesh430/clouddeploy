import { z } from "zod";

const schema = z.object({
  API_URL: z.string().default("http://localhost:4000"),
  AGENT_TOKEN: z.string().min(1, "AGENT_TOKEN is required — register this node via POST /admin/infrastructure/servers and copy the returned agentToken"),
  AGENT_VERSION: z.string().default("0.1.0"),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(5_000).default(15_000),
  CONTAINER_LABEL_KEY: z.string().default("com.clouddeploy.container-id"),
});

export type RuntimeAgentEnv = z.infer<typeof schema>;

export function loadEnv(): RuntimeAgentEnv {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error("[runtime-agent] invalid environment:", result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
