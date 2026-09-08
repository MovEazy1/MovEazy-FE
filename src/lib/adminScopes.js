/**
 * Staff roles and permission scopes for the internal CRM.
 *
 * This file is the UI half of the check. The authority is Postgres:
 * public.has_admin_scope() in MovEazy-BE/supabase/crm_schema.sql is written
 * against the same strings, and every CRM table's RLS policy uses it. Hiding a
 * button here is a courtesy; the database is what actually refuses.
 *
 * ADDING A ROLE: add an entry to ROLE_DEFINITIONS below and nothing else — no
 * migration, no new table, no policy rewrite. The scopes it lists already exist
 * and are already enforced.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { SUPERADMIN_EMAIL, isSuperAdminEmail, normalizeAdminEmail } from "./adminAccess";

/** Every permission the CRM understands. Keep in sync with has_admin_scope(). */
export const SCOPES = {
  CLIENTS_READ_ALL: "crm.clients.read.all",
  CLIENTS_READ_ASSIGNED: "crm.clients.read.assigned",
  CLIENTS_WRITE: "crm.clients.write",
  CLIENTS_DELETE: "crm.clients.delete",
  REQUIREMENTS_WRITE: "crm.requirements.write",
  PROPERTIES_READ: "crm.properties.read",
  PROPERTIES_WRITE: "crm.properties.write",
  PROPERTIES_VERIFY: "crm.properties.verify",
  VISITS_WRITE: "crm.visits.write",
  TEMPLATES_USE: "crm.templates.use",
  TEMPLATES_WRITE: "crm.templates.write",
  ANALYTICS_READ: "crm.analytics.read",
  ROLES_WRITE: "admin.roles.write",
};

export const SCOPE_LABELS = {
  [SCOPES.CLIENTS_READ_ALL]: "See every client",
  [SCOPES.CLIENTS_READ_ASSIGNED]: "See only their assigned clients",
  [SCOPES.CLIENTS_WRITE]: "Add clients, change status, temperature, notes",
  [SCOPES.CLIENTS_DELETE]: "Delete a client record",
  [SCOPES.REQUIREMENTS_WRITE]: "Edit the CRM requirement override",
  [SCOPES.PROPERTIES_READ]: "Browse inventory in the CRM",
  [SCOPES.PROPERTIES_WRITE]: "Add and edit listings",
  [SCOPES.PROPERTIES_VERIFY]: "Mark a listing verified",
  [SCOPES.VISITS_WRITE]: "Create slots, book and cancel visits",
  [SCOPES.TEMPLATES_USE]: "Send using an existing template",
  [SCOPES.TEMPLATES_WRITE]: "Edit the templates everyone sends",
  [SCOPES.ANALYTICS_READ]: "See dashboards and export",
  [SCOPES.ROLES_WRITE]: "Grant and revoke roles",
};

/** Everything except the one scope that can never be delegated. */
const ALL_CRM_SCOPES = Object.values(SCOPES).filter((s) => s !== SCOPES.ROLES_WRITE);

/**
 * The roles that exist today. Only two, deliberately — the scope machinery is
 * general, so the next role is an entry here rather than a rebuild.
 */
export const ROLE_DEFINITIONS = {
  super_admin: {
    id: "super_admin",
    label: "Super admin",
    hint: "Everything, including granting roles. Hardcoded to one email.",
    scopes: [...ALL_CRM_SCOPES, SCOPES.ROLES_WRITE],
    assignable: false, // never offered in the Team screen
  },
  crm_manager: {
    id: "crm_manager",
    label: "CRM manager",
    hint: "Full CRM: every client, inventory, visits and the shared message templates. Cannot grant roles.",
    scopes: ALL_CRM_SCOPES,
    assignable: true,
  },
};

/** Roles the super admin may hand out in the Team screen. */
export const ASSIGNABLE_ROLES = Object.values(ROLE_DEFINITIONS).filter((r) => r.assignable);

export function scopesForRole(roleId) {
  return ROLE_DEFINITIONS[roleId]?.scopes ?? [];
}

export function roleLabel(roleId) {
  return ROLE_DEFINITIONS[roleId]?.label ?? roleId ?? "—";
}

/* ── Reading the caller's own access ──────────────────────────────────────── */

let cache = { email: null, row: null, at: 0 };
const TTL_MS = 60_000;

export function invalidateAdminRoleCache() {
  cache = { email: null, row: null, at: 0 };
}

/**
 * The signed-in user's staff row. Super admin resolves without a round trip so
 * the CRM still opens if the table hasn't been created yet.
 */
export async function fetchMyAdminRole(email) {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) return null;

  if (isSuperAdminEmail(normalized)) {
    return { email: normalized, role: "super_admin", scopes: ROLE_DEFINITIONS.super_admin.scopes };
  }
  if (cache.email === normalized && Date.now() - cache.at < TTL_MS) return cache.row;
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from("admin_roles")
      .select("email, role, scopes")
      .ilike("email", normalized)
      .maybeSingle();
    if (error) {
      // Table not created yet, or no read access — not staff, not an error.
      cache = { email: normalized, row: null, at: Date.now() };
      return null;
    }
    const row = data ? { ...data, scopes: data.scopes ?? [] } : null;
    cache = { email: normalized, row, at: Date.now() };
    return row;
  } catch {
    return null;
  }
}

export async function fetchAdminRoster() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("admin_roles")
    .select("email, role, scopes, notes, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function grantAdminRole(email, roleId, notes = "") {
  const normalized = normalizeAdminEmail(email);
  if (!normalized || !normalized.includes("@")) throw new Error("Enter a valid email address.");
  if (!ROLE_DEFINITIONS[roleId]?.assignable) throw new Error("That role can't be assigned.");
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("admin_roles")
    .upsert(
      {
        email: normalized,
        role: roleId,
        scopes: scopesForRole(roleId),
        notes: String(notes || "").trim().slice(0, 240),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select("email, role, scopes, notes, created_at")
    .single();
  if (error) throw error;
  invalidateAdminRoleCache();
  return data;
}

export async function revokeAdminRole(email) {
  const normalized = normalizeAdminEmail(email);
  if (isSuperAdminEmail(normalized)) throw new Error("The super admin can't be removed.");
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("admin_roles").delete().ilike("email", normalized);
  if (error) throw error;
  invalidateAdminRoleCache();
}

export { SUPERADMIN_EMAIL, isSuperAdminEmail };
