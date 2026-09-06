import * as Sentry from "@sentry/browser";

let initialized = false;

/** A no-op unless NEXT_PUBLIC_SENTRY_DSN is set at build time — safe to
 * call unconditionally from a client component. Once a real DSN is added,
 * this captures unhandled errors/rejections in the browser for real without
 * any other code changes. */
export function initErrorTracking(): void {
  if (initialized || typeof window === "undefined") return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
  initialized = true;
}
