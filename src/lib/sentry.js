const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

let initPromise = null;

function ensureSentry() {
  if (!dsn || typeof window === "undefined") return null;
  if (!initPromise) {
    initPromise = import("@sentry/react").then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ],
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
        replaysSessionSampleRate: import.meta.env.PROD ? 0.05 : 0,
        replaysOnErrorSampleRate: import.meta.env.PROD ? 1 : 0,
      });
      return Sentry;
    });
  }
  return initPromise;
}

export function captureException(error, captureContext) {
  if (!dsn || !error) return;
  void ensureSentry()?.then((Sentry) => {
    Sentry.captureException(error, captureContext);
  });
}
