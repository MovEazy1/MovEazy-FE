import { createClient } from "@supabase/supabase-js";

const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
/** Legacy anon JWT or new publishable key (sb_publishable_…). */
const anonKey =
  String(import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
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
