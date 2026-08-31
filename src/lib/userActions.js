import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * User-action audit trail — one row per meaningful thing a renter does
 * (shortlisting a property, submitting a visit preference, …). Written to
 * public.user_actions so the admin panel can review activity both user-wise
 * ("what did this user do") and property-wise ("who's interested in this home").
 *
 * Every call is best-effort: logging must never block or break the UI, so all
 * failures are swallowed. Requires MovEazy-BE/supabase/user_actions_schema.sql.
 */

export const ACTIONS = {
  SHORTLIST: "shortlist_property",
  UNSHORTLIST: "remove_shortlist",
  VISIT_PREFERENCE: "visit_preference_submitted",
  VISIT_BOOKED: "visit_slot_booked",
};

/**
 * Record a single user action.
 * @param {object} user  — the signed-in user (needs uid/id + email).
 * @param {string} action — one of ACTIONS (or any short slug).
 * @param {object} [details] — extra context; `property_id` is lifted to its own column.
 */
export async function logUserAction(user, action, details = {}) {
  const uid = user?.uid || user?.id;
  if (!isSupabaseConfigured || !supabase || !uid || !action) return;
  try {
    const { property_id, ...rest } = details || {};
    await supabase.from("user_actions").insert({
      user_id: uid,
      email: String(user?.email || "").toLowerCase().trim(),
      action,
      property_id: property_id != null ? String(property_id) : null,
      details: rest && typeof rest === "object" ? rest : {},
    });
  } catch {
    /* best-effort — never surface logging errors to the user */
  }
}

/** All actions for one user (admin — user-wise view). */
export async function fetchUserActions(uid, { limit = 500 } = {}) {
  if (!isSupabaseConfigured || !supabase || !uid) return [];
  const { data, error } = await supabase
    .from("user_actions")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

/** All actions on one property (admin — property-wise view). */
export async function fetchPropertyActions(propertyId, { limit = 500 } = {}) {
  if (!isSupabaseConfigured || !supabase || !propertyId) return [];
  const { data, error } = await supabase
    .from("user_actions")
    .select("*")
    .eq("property_id", String(propertyId))
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}
