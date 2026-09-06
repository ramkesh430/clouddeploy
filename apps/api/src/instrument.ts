import * as Sentry from "@sentry/node";

// Imported first, before any other module, per Sentry's own setup
// instructions — this is what lets it auto-instrument things that get
// imported afterward. A no-op with SENTRY_DSN unset: init() is never
// called, so every Sentry.* call elsewhere (see AllExceptionsFilter)
// silently does nothing rather than throwing.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
}
