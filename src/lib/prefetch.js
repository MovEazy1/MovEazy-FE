/**
 * Fetch the code for the screens people usually open next, once the current
 * one has settled, so tapping them is instant.
 *
 * Skipped on Data Saver and slow (2G/3G) connections, where those bytes are
 * better left unspent. Runs when the browser is idle — never in the way of
 * what is on screen. Each loader is the same import() as the lazy route, so a
 * screen fetched here is never fetched twice.
 */
export function isConstrainedNetwork(conn = typeof navigator !== "undefined" ? navigator.connection : null) {
  if (!conn) return false;
  return Boolean(conn.saveData) || /(^|-)(2g|3g)$/.test(String(conn.effectiveType || ""));
}

export function prefetchWhenIdle(loaders, { delay = 2500 } = {}) {
  if (typeof window === "undefined" || isConstrainedNetwork()) return () => {};
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    for (const load of loaders) load().catch(() => { /* fetched on demand instead */ });
  };
  const idle = window.requestIdleCallback
    ? () => window.requestIdleCallback(run, { timeout: 5000 })
    : run;
  const t = setTimeout(idle, delay);
  return () => { cancelled = true; clearTimeout(t); };
}
