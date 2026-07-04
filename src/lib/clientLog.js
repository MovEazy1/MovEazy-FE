import { captureException } from "./sentry";

const isDev = import.meta.env.DEV;

/**
 * Production: do not print raw Error/Firebase objects to the browser console
 * (messages, codes, and stacks help fingerprinting and targeted abuse).
 * Send to Sentry when configured; dev keeps console for local debugging.
 */
export function reportClientError(context, err, options = {}) {
  const { skipSentry = false } = options;
  if (!skipSentry && err) captureException(err, { tags: { context: String(context || "app") } });
  if (isDev && err) console.error(`[${context}]`, err);
}

/** Non-fatal diagnostics: dev-only console (no exception payloads in prod). */
export function reportClientWarn(context, message, detail) {
  if (!isDev) return;
  if (detail !== undefined) console.warn(`[${context}]`, message, detail);
  else console.warn(`[${context}]`, message);
}
