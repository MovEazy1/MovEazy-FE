import { supabase, isSupabaseConfigured } from "./supabase";
import { isEmailAdminAllowed } from "./adminAccess";

export const VALID_ROLES = ["admin", "broker", "seller", "customer", "consultant", "sub_admin"];

export function normalizeSignupRole(role) {
  if (role === "seller") return "seller";
  if (role === "broker") return "broker";
  if (role === "admin") return "admin";
  return "customer";
}

function resolveRole(roleCandidate) {
  return VALID_ROLES.includes(roleCandidate) ? roleCandidate : "customer";
}

function isBrokerLikeRole(role) {
  return role === "seller" || role === "broker";
}

function resolveEmail(sbUser) {
  return String(sbUser?.email || "").toLowerCase().trim();
}

function resolveName(sbUser, email) {
  const meta = sbUser?.user_metadata || {};
  return meta.full_name || meta.name || (email ? email.split("@")[0] : "User");
}

function rowToProfile(row, sbUser) {
  return {
    uid: row.id,
    email: row.email,
    name: row.name || resolveName(sbUser, row.email),
    role: resolveRole(row.role),
    phone: row.phone || "",
    sellerBadgeStatus: row.seller_badge_status ?? null,
    sellerBadgeApplication: row.seller_badge_application || null,
    profileComplete: row.profile_complete === true,
  };
}

async function fetchProfileRow(uid) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from("user_profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * A `handle_new_user` DB trigger already creates the base row the instant the
 * auth.users row exists (see customer_schema.sql), so this succeeds whether or
 * not the client has a session yet (e.g. pending email confirmation). This call
 * just enriches phone/name — best-effort, since the trigger already covers
 * account creation.
 */
export async function createProfileAfterSignup({ sbUser, name, role, phone }) {
  const email = resolveEmail(sbUser);
  if (!email) throw new Error("Could not resolve account email for profile.");
  if (!isSupabaseConfigured || !supabase) return;
  const normalizedRole = normalizeSignupRole(role);
  try {
    await supabase.from("user_profiles").upsert(
      {
        id: sbUser.id,
        email,
        name: name || email.split("@")[0],
        phone: phone || "",
        role: normalizedRole,
        seller_badge_status: isBrokerLikeRole(normalizedRole) ? "none" : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {
    /* trigger already created the row; this enrichment can retry via ensureUserProfileDocuments */
  }
}

export async function getProfileForUser(sbUser) {
  const email = resolveEmail(sbUser);
  if (!email) {
    return {
      email: "",
      name: resolveName(sbUser, email),
      role: "customer",
      sellerBadgeStatus: null,
      phone: sbUser?.phone || "",
      uid: sbUser?.id,
      profileComplete: false,
    };
  }
  if (await isEmailAdminAllowed(email)) {
    return {
      email,
      name: "MovEazy Admin",
      role: "admin",
      sellerBadgeStatus: null,
      phone: "",
      uid: sbUser.id,
      profileComplete: true,
    };
  }

  const row = await fetchProfileRow(sbUser.id);
  if (!row) {
    return {
      uid: sbUser.id,
      email,
      name: resolveName(sbUser, email),
      role: resolveRole(sbUser?.user_metadata?.role),
      phone: sbUser?.phone || "",
      sellerBadgeStatus: null,
      profileComplete: false,
    };
  }
  return rowToProfile(row, sbUser);
}

/**
 * Every verified sign-in should have a user_profiles row so Admin "User Management" lists customers.
 * Accounts created before this fix, or outside the signup flow, may be missing it.
 */
export async function ensureUserProfileDocuments(sbUser) {
  if (!sbUser || !isSupabaseConfigured || !supabase) return;
  const email = resolveEmail(sbUser);
  if (!email) return;

  const existing = await fetchProfileRow(sbUser.id);

  if (await isEmailAdminAllowed(email)) {
    await supabase.from("user_profiles").upsert(
      {
        id: sbUser.id,
        email,
        name: existing?.name || resolveName(sbUser, email),
        phone: existing?.phone || "",
        role: "admin",
        seller_badge_status: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    return;
  }

  if (existing) {
    if (!String(existing.phone || "").trim() && sbUser?.phone) {
      await supabase
        .from("user_profiles")
        .update({ phone: sbUser.phone, updated_at: new Date().toISOString() })
        .eq("id", sbUser.id);
    }
    return;
  }

  const metaRole = sbUser?.user_metadata?.role;
  const role = metaRole ? resolveRole(metaRole) : "customer";
  const name = resolveName(sbUser, email);
  const phone = sbUser?.phone || "";

  await supabase.from("user_profiles").upsert(
    {
      id: sbUser.id,
      email,
      name,
      phone,
      role,
      seller_badge_status: isBrokerLikeRole(role) ? "none" : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}

export async function getProfileByEmail(email) {
  const normalized = String(email || "").toLowerCase().trim();
  if (!normalized || !isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .ilike("email", normalized)
    .maybeSingle();
  if (error || !data) return null;
  return { uid: data.id, email: normalized, name: data.name || normalized.split("@")[0], ...data, role: resolveRole(data.role) };
}

/** Update mutable profile fields (name/phone/flat search mirror) for a signed-in user. */
export async function updateUserProfileFields(uid, updates) {
  if (!uid || !isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const payload = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = String(updates.name || "").trim();
  if (updates.phone !== undefined) payload.phone = String(updates.phone || "").trim();
  if (updates.flatSearch !== undefined) payload.flat_search = updates.flatSearch;
  const { error } = await supabase.from("user_profiles").update(payload).eq("id", uid);
  if (error) throw error;
}

/** Admin: list seller accounts with a pending verified-badge application. */
export async function getPendingSellerBadgeApplicationsRemote() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, name, seller_badge_application")
    .eq("seller_badge_status", "pending");
  if (error) return [];
  return (data || []).map((row) => ({
    uid: row.id,
    email: row.email,
    name: row.name || String(row.email || "seller").split("@")[0],
    application: row.seller_badge_application || null,
  }));
}

export async function submitSellerBadgeApplicationRemote(uid, application) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("user_profiles")
    .update({ seller_badge_status: "pending", seller_badge_application: application, updated_at: new Date().toISOString() })
    .eq("id", uid);
  if (error) throw error;
}

export async function setSellerBadgeStatusForEmail(email, status) {
  const profile = await getProfileByEmail(email);
  if (!profile) return false;
  const { error } = await supabase
    .from("user_profiles")
    .update({ seller_badge_status: status, updated_at: new Date().toISOString() })
    .eq("id", profile.uid);
  return !error;
}

export async function setRoleForEmail(email, role) {
  const profile = await getProfileByEmail(email);
  if (!profile) return false;
  const { error } = await supabase
    .from("user_profiles")
    .update({ role: normalizeSignupRole(role), updated_at: new Date().toISOString() })
    .eq("id", profile.uid);
  return !error;
}
