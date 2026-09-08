/**
 * Persist website sessions to Supabase.
 *
 * lib/sessionTracking.js has always counted sessions, page durations and device
 * — but only into sessionStorage/localStorage, where the data dies with the
 * visitor's cache and is invisible to us. This is the half that was missing: it
 * writes each session to public.user_sessions so the CRM can sort clients by
 * "most opens" and "most time on site".
 *
 * Deliberately defensive: every failure is swallowed. Analytics must never break
 * a page for a visitor, and a blocked write is not worth a console error on
 * every navigation.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { sessionTracker } from "./sessionTracking";
import { readUtm } from "./shareAttribution";

const ANON_KEY = "moveazy_anon_id";
/** Sessions shorter than this are a bounce or a redirect — not worth a row. */
const MIN_SECONDS = 3;
const FLUSH_INTERVAL_MS = 30_000;

let rowId = null;
let timer = null;
let started = false;
let current = { userId: null, email: "" };

function anonId() {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function snapshot() {
  const data = sessionTracker.getSessionData() || {};
  const pages = Array.isArray(data.pages) ? data.pages : [];
  return {
    started_at: data.startTime || new Date().toISOString(),
    ended_at: new Date().toISOString(),
    duration_seconds: Math.max(0, Math.round(Number(data.duration) || 0)),
    page_count: pages.length,
    // Trim to the fields we'd actually read back; a full page log per session
    // adds up fast and nothing in the CRM uses the rest.
    pages: pages.slice(0, 40).map((p) => ({
      page: p.page,
      visits: p.visits,
      duration: Math.round((p.duration || 0) / 1000),
    })),
    device: data.deviceInfo?.type || "",
    os: data.deviceInfo?.os || "",
  };
}

async function flush() {
  if (!isSupabaseConfigured || !supabase) return;
  const snap = snapshot();
  if (snap.duration_seconds < MIN_SECONDS) return;

  const payload = {
    ...snap,
    user_id: current.userId,
    email: current.email,
    anon_id: anonId(),
    referrer: typeof document !== "undefined" ? String(document.referrer || "").slice(0, 300) : "",
    // So "arrived from the CRM" is answerable even when a link was forwarded
    // and its per-share token no longer identifies the right person.
    utm: readUtm(),
  };

  try {
    if (rowId) {
      await supabase.from("user_sessions").update(payload).eq("id", rowId);
      return;
    }
    const { data, error } = await supabase.from("user_sessions").insert(payload).select("id").single();
    if (!error && data) rowId = data.id;
  } catch {
    /* analytics must never surface to the visitor */
  }
}

/**
 * Attach a signed-in identity to this session.
 *
 * Called again whenever auth resolves, because a session usually starts logged
 * out and becomes identified a few seconds later — without this, every visit
 * that begins on the marketing page would be counted as anonymous.
 */
export function identifySession(user) {
  const userId = user?.uid || null;
  const email = user?.email || "";
  if (current.userId === userId && current.email === email) return;
  current = { userId, email };
  if (started) flush();
}

export function startSessionSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  timer = setInterval(flush, FLUSH_INTERVAL_MS);

  // visibilitychange is the one that actually fires when a phone browser is
  // backgrounded or the tab is closed on mobile; pagehide covers desktop.
  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);

  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", flush);
    started = false;
  };
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
