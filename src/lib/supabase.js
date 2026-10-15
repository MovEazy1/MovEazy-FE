import { createClient } from "@supabase/supabase-js";

const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
/** Legacy anon JWT or new publishable key (sb_publishable_…). */
const anonKey =
  String(import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * A request the server turned away with "JWT expired" is refreshed and sent
 * once more. The client only sends a token its own clock says is still good,
 * so this happens when that clock runs behind the server's, or when a laptop
 * wakes with an old token: the visitor used to see "JWT expired" on whatever
 * they were saving, and a failed profile read put up the phone gate for a
 * number that was already saved.
 */
let refreshing = null;
export async function fetchRefreshingExpired(input, init) {
  const res = await fetch(input, init);
  // Auth's own calls are left alone: they run inside its lock, which a refresh would wait on.
  if (res.status !== 401 || !supabase || String(input?.url ?? input).includes("/auth/v1/")) return res;
  let body = "";
  try { body = await res.clone().text(); } catch { return res; }
  if (!/jwt expired/i.test(body)) return res;
  refreshing ||= supabase.auth.refreshSession().finally(() => { refreshing = null; });
  const token = (await refreshing.catch(() => null))?.data?.session?.access_token;
  if (!token) return res;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      global: { fetch: fetchRefreshingExpired },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Do not throw on fetch errors — let callers handle gracefully
        flowType: "pkce",
      },
    })
  : null;

/**
 * Fetch which auth providers are enabled on this Supabase project.
 * Returns a cached promise so it's only called once.
 */
let _settingsPromise = null;
export async function getSupabaseAuthSettings() {
  if (!isSupabaseConfigured) return null;
  if (_settingsPromise) return _settingsPromise;
  _settingsPromise = fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: anonKey },
  })
    .then((r) => r.json())
    .catch(() => null);
  return _settingsPromise;
}

/**
 * Translate a Supabase auth error into a user-friendly message.
 */
export function normalizeSupabaseError(error) {
  const msg = String(error?.message || error?.error_description || error?.msg || "").toLowerCase();
  const status = error?.status;
  if (!msg && !status) return "Something went wrong. Please try again.";
  if (status === 500 || msg.includes("unexpected_failure") || msg.includes("failed to send"))
    return "Could not send confirmation email — email is not yet configured in Supabase. Ask the admin to disable \"Confirm email\" in the Supabase Auth settings, or set up a custom SMTP provider.";
  if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials"))
    return "Invalid email or password.";
  if (msg.includes("email already registered") || msg.includes("user already registered"))
    return "Account already exists — please sign in.";
  if (msg.includes("password should be at least"))
    return "Password must be at least 6 characters.";
  if (msg.includes("unable to validate email address"))
    return "Please enter a valid email address.";
  if (msg.includes("email rate limit"))
    return "Too many attempts — please wait a few minutes and try again.";
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("tunnel"))
    return "Network error — check your internet connection and try again.";
  return error?.message || "Authentication failed. Please try again.";
}

/**
 * Is somebody probably signed in on this device? Read straight from the saved
 * session, before Supabase has started — so a page can begin downloading the
 * signed-out screen (a landing page) only when it is likely to be shown.
 * A guess: the real answer still comes from AuthContext.
 */
export function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^sb-.+-auth-token$/.test(k || "")) return true;
    }
  } catch {
    /* storage blocked */
  }
  return false;
}

/** The account id in Supabase's saved session on this device, or "" — read without starting Supabase. */
export function storedSessionUid() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/^sb-.+-auth-token$/.test(k || "")) continue;
      const v = JSON.parse(localStorage.getItem(k) || "null");
      return String(v?.user?.id || v?.currentSession?.user?.id || "");
    }
  } catch {
    /* storage blocked or not JSON */
  }
  return "";
}
