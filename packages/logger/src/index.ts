import pino from "pino";

/**
 * Structured JSON logger shared by every process (API, build worker,
 * runtime agent). Each subsystem should call `createLogger("subsystem-name")`
 * so log lines can be filtered by origin in Loki/Grafana.
 */
export function createLogger(name: string) {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? "info",
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
        : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
