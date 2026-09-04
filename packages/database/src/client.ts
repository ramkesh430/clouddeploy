import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __clouddeployPrisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client. Reused across hot reloads in development so we
 * don't exhaust the Postgres connection pool.
 */
export const prisma =
  global.__clouddeployPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__clouddeployPrisma = prisma;
}
