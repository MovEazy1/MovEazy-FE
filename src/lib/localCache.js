/**
 * What an app showed last time, kept on the device so it can open instantly
 * and refresh in the background (stale-while-revalidate).
 *
 * IndexedDB, not localStorage: the CRM's copy runs to megabytes, localStorage
 * caps out near 5 MB and blocks the page while it parses.
 *
 * Every entry belongs to one signed-in account and carries the time it was
 * written. It is dropped:
 *   - when it is older than the caller's limit (the CRM keeps 7 days, the
 *     partner and owner apps 30) — counted from the last time the app was
 *     opened, since every open writes a fresh copy;
 *   - on sign-out, and when somebody else signs in on the device
 *     (clearCacheExcept, AuthContext);
 *   - when CACHE_VERSION changes, so a release that changes a shape never
 *     reads an old one back.
 * Failures are silent: no cache just means loading the way it always did.
 */

const DB = "moveazy-cache";
const STORE = "entries";
export const CACHE_VERSION = 1;
export const DAY_MS = 24 * 60 * 60 * 1000;
// Set once anything is saved, so a device that never saved anything (every
// signed-out visitor) never has to open the database just to find it empty.
const MARKER = "mz_cache_present";
const hasMarker = () => { try { return localStorage.getItem(MARKER) === "1"; } catch { return false; } };

let dbPromise = null;
function db() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("no indexedDB"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

function tx(mode, run) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/** The owner for data anybody may see (published listings): kept across sign-in and sign-out. */
export const PUBLIC = "public";

/** The key for one account's copy of one thing: "<uid>:<name>". */
export const cacheKey = (uid, name) => `${uid}:${name}`;

/** Is a stored entry still usable? Pure, for the tests. */
export function isFresh(entry, maxAgeMs, now = Date.now()) {
  return Boolean(entry) && entry.v === CACHE_VERSION && typeof entry.at === "number"
    && now - entry.at >= 0 && now - entry.at <= maxAgeMs;
}

/** The saved copy, or null if there is none, it is too old, or it is from another release. */
export async function readCache(uid, name, maxAgeMs) {
  if (!uid || !hasMarker()) return null;
  try {
    const entry = await tx("readonly", (s) => s.get(cacheKey(uid, name)));
    if (isFresh(entry, maxAgeMs)) return entry.data;
    if (entry) dropCache(uid, name);
    return null;
  } catch {
    return null;
  }
}

export async function writeCache(uid, name, data) {
  if (!uid) return;
  try {
    await tx("readwrite", (s) => s.put({ v: CACHE_VERSION, at: Date.now(), data }, cacheKey(uid, name)));
    try { localStorage.setItem(MARKER, "1"); } catch { /* ignore */ }
  } catch {
    /* full, private mode, or blocked: next open loads normally */
  }
}

export async function dropCache(uid, name) {
  try { await tx("readwrite", (s) => s.delete(cacheKey(uid, name))); } catch { /* ignore */ }
}

/** Wipe everything except what belongs to `uid` (pass null to wipe all — sign-out). */
export async function clearCacheExcept(uid) {
  if (!hasMarker()) return;
  try {
    const keys = await tx("readonly", (s) => s.getAllKeys());
    const gone = (keys ?? []).filter((k) => !String(k).startsWith(`${PUBLIC}:`) && (!uid || !String(k).startsWith(`${uid}:`)));
    if (gone.length) await tx("readwrite", (s) => { gone.forEach((k) => s.delete(k)); });
    if (!uid) localStorage.removeItem(MARKER);
  } catch {
    /* ignore */
  }
}
