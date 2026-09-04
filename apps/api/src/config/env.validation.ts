import { parseEnv } from "@clouddeploy/config";

/** Passed to ConfigModule.forRoot({ validate }) — fails fast on boot if misconfigured. */
export function validateEnv(config: Record<string, unknown>) {
  return parseEnv(config as NodeJS.ProcessEnv);
}
