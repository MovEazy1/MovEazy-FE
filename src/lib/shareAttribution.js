/**
 * The other half of a tracked share: noticing when the recipient opens it.
 *
 * A link sent from the CRM carries `mz_s`, a token identifying one client + one
 * property. When any page loads with that token we call record_share_open(),
 * which bumps the counter and — on the first open only — writes "Opened the link
 * you sent" into that client's timeline.
 *
 * This runs for signed-out visitors, which is the normal case: someone tapping a
 * WhatsApp link has no session. That's why the write goes through a
 * security-definer function rather than the table.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

const SEEN_KEY = "moveazy_share_opens";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

function alreadyCounted(token) {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return seen.includes(token);
  } catch {
    return false;
  }
}

function markCounted(token) {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    seen.push(token);
    // Only needed to stop a refresh double-counting; no reason to keep more.
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-200)));
  } catch {
    /* private mode — worst case the open counts twice */
  }
}

/** UTM parameters on the current URL, for stamping onto the session row. */
export function readUtm() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) out[k] = String(v).slice(0, 120);
  }
  return out;
}

/**
 * Record an open if this page load came from a tracked share.
 * Silent and best-effort: attribution must never break the page for a visitor.
 */
export async function recordShareOpenFromUrl() {
  if (typeof window === "undefined") return;
  const token = new URLSearchParams(window.location.search).get("mz_s");
  if (!token || token.length < 8) return;
  if (alreadyCounted(token)) return;
  if (!isSupabaseConfigured || !supabase) return;

  // Mark first: a failed call shouldn't leave the page retrying on every render.
  markCounted(token);
  try {
    await supabase.rpc("record_share_open", { token });
  } catch {
    /* ignore */
  }
}
