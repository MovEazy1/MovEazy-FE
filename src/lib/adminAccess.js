import { supabase, isSupabaseConfigured } from "./supabase";

const DEFAULT_BOOTSTRAP = "yatharth200018@gmail.com";

/** Emails from VITE_ADMIN_EMAILS — always treated as admin even before the table exists. */
export function getEnvAdminEmails() {
  return String(import.meta.env.VITE_ADMIN_EMAILS || DEFAULT_BOOTSTRAP)
    .split(",")
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
}

export function normalizeAdminEmail(email) {
  return String(email || "").toLowerCase().trim();
}

let allowlistCache = null;
let allowlistCacheAt = 0;
const CACHE_TTL_MS = 45_000;

export function invalidateAdminAllowlistCache() {
  allowlistCache = null;
  allowlistCacheAt = 0;
}

async function loadAllowlistRows() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("admin_allowlist")
    .select("id, email, notes, created_at, added_by")
    .order("created_at", { ascending: true });
  if (error) {
    if (String(error.message || "").toLowerCase().includes("does not exist")) return [];
    throw error;
  }
  return data ?? [];
}

export async function fetchAdminAllowlist({ force = false } = {}) {
  const fresh = allowlistCache && Date.now() - allowlistCacheAt < CACHE_TTL_MS;
  if (!force && fresh) return allowlistCache;
  const rows = await loadAllowlistRows();
  allowlistCache = rows;
  allowlistCacheAt = Date.now();
  return rows;
}

export async function isEmailAdminAllowed(email) {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) return false;
  if (getEnvAdminEmails().includes(normalized)) return true;
  try {
    const rows = await fetchAdminAllowlist();
    return rows.some((row) => normalizeAdminEmail(row.email) === normalized);
  } catch {
    return getEnvAdminEmails().includes(normalized);
  }
}

export async function addAdminAllowlistEmail(email, notes = "") {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) throw new Error("Enter a valid email.");
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured — add VITE_SUPABASE_URL and anon key.");
  }
  const { data, error } = await supabase
    .from("admin_allowlist")
    .insert({ email: normalized, notes: String(notes || "").trim().slice(0, 240) })
    .select("id, email, notes, created_at, added_by")
    .single();
  if (error) {
    if (String(error.message || "").toLowerCase().includes("duplicate")) {
      throw new Error("That email is already on the admin allowlist.");
    }
    throw error;
  }
  invalidateAdminAllowlistCache();
  return data;
}

export async function removeAdminAllowlistEmail(id) {
  if (!id) throw new Error("Missing allowlist row id.");
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  const { error } = await supabase.from("admin_allowlist").delete().eq("id", id);
  if (error) throw error;
  invalidateAdminAllowlistCache();
}
