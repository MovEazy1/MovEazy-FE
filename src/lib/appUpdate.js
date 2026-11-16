/**
 * Keeping an open app on the current version.
 *
 * An installed app (the partner app on a phone's home screen) can stay open
 * for days. After a deploy it still runs the old version, whose screens are
 * files the new version no longer has, so opening a screen fails or hangs.
 *
 *   reloadForUpdate()  loads the new version — at most once every 30 s, so a
 *                      file that is really missing can't reload forever (the
 *                      old guard allowed one reload per page per session,
 *                      which a second deploy the same day never got past).
 *   watchForUpdates()  when the app comes back to the screen, asks the server
 *                      which version is current; if it isn't this one, loads
 *                      it right then.
 */
const ENTRY = /\/assets\/index-[\w-]+\.js/;
const KEY = "mz-update-reload-at";

/** Load the new version, unless that was just done. → true when reloading. */
export function reloadForUpdate() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** The running version's entry file, e.g. "/assets/index-I9eve3t_.js". */
function runningEntry() {
  for (const s of document.scripts) {
    const m = String(s.getAttribute("src") || "").match(ENTRY);
    if (m) return m[0];
  }
  return null;
}

/** The current version's entry file, from the server (never a cached copy). */
async function currentEntry() {
  try {
    const res = await fetch("/index.html", { cache: "no-store", credentials: "omit" });
    if (!res.ok) return null;
    return (await res.text()).match(ENTRY)?.[0] ?? null;
  } catch {
    return null;
  }
}

/** A failed screen file: the sign of an old version after a deploy. */
export const isStaleChunkError = (e) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS/i.test(String(e?.message || e || ""));

export function watchForUpdates() {
  const mine = runningEntry();
  if (!mine || typeof document === "undefined") return;
  let hiddenAt = 0;
  let lastCheck = 0;
  const check = async () => {
    if (Date.now() - lastCheck < 60000) return; // at most one check a minute
    lastCheck = Date.now();
    const now = await currentEntry();
    if (now && now !== mine && document.visibilityState === "visible") reloadForUpdate();
  };
  // Only after being away 30 s or more — never while someone is mid-way through a screen.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt >= 30000) check();
  });
  // Brought back from the browser's back/forward memory.
  window.addEventListener("pageshow", (e) => { if (e.persisted) check(); });
}
