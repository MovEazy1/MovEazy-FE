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

export function prefetchWhenIdle(loaders, { delay = 2500, fallback = 12000 } = {}) {
  if (typeof window === "undefined" || isConstrainedNetwork()) return () => {};
  let cancelled = false;
  let fallbackTimer = 0;
  const run = () => {
    if (cancelled) return;
    for (const load of loaders) load().catch(() => { /* fetched on demand instead */ });
  };
  const idle = () => {
    stopWaiting();
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 5000 });
    else run();
  };
  // Importing a screen runs its code, so it waits for the person to do
  // something (scroll, tap, type) — never in the middle of the first paint
  // and the page settling — or for `fallback` ms if they only read.
  const INTENT = ["pointerdown", "touchstart", "scroll", "keydown"];
  function stopWaiting() {
    clearTimeout(fallbackTimer);
    for (const e of INTENT) window.removeEventListener(e, idle, true);
  }
  const wait = () => {
    if (cancelled) return;
    for (const e of INTENT) window.addEventListener(e, idle, { capture: true, once: true, passive: true });
    fallbackTimer = setTimeout(idle, fallback);
  };
  const t = setTimeout(wait, delay);
  return () => { cancelled = true; clearTimeout(t); stopWaiting(); };
}
