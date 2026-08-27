import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Per-user requirement profile — the demand side, one row per user_id in the
 * public.user_requirements table. Populated when a user completes the guided
 * "Find My Flat" questionnaire (AIBroker.jsx). Described in the shared
 * preferenceOptions vocabulary so it scores directly against inventory.
 */

function arr(v) {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  return [];
}
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Map the AIBroker `prefs` object to a user_requirements DB row. */
export function prefsToRow(prefs, user, extra = {}) {
  const p = prefs || {};
  return {
    user_id: user?.uid || user?.id,
    email: String(user?.email || "").toLowerCase().trim(),
    office: p.office || null,
    age: String(p.age || "").slice(0, 40),
    localities: arr(p.localities),
    budget_min: num(p.budgetMin),
    budget_max: num(p.budgetMax),
    stretch: !!p.stretch,
    occupants: arr(p.occupants),
    flat_types: arr(p.flatTypes),
    must_haves: arr(p.mustHaves),
    lifestyle: arr(p.lifestyle),
    deal_breakers: arr(p.dealBreakers),
    priority: arr(p.priority),
    notes: p.notes && typeof p.notes === "object" ? p.notes : {},
    updated_at: new Date().toISOString(),
    ...extra,
  };
}

/** Map a saved user_requirements DB row back to the AIBroker `prefs` shape, so
 *  "Modify my preferences" can pre-fill every answer. Inverse of prefsToRow.
 *  (Deliberately doesn't map a phone/whatsapp field — AIBroker's phone step
 *  reads/writes user_profiles.phone directly, not this table.) */
export function rowToPrefs(row) {
  if (!row) return null;
  return {
    office: row.office || null,
    age: row.age || "",
    localities: arr(row.localities),
    budgetMin: num(row.budget_min) ?? 20000,
    budgetMax: num(row.budget_max) ?? 45000,
    stretch: !!row.stretch,
    occupants: arr(row.occupants),
    flatTypes: arr(row.flat_types),
    mustHaves: arr(row.must_haves),
    lifestyle: arr(row.lifestyle),
    dealBreakers: arr(row.deal_breakers),
    priority: arr(row.priority),
    notes: row.notes && typeof row.notes === "object" ? row.notes : {},
  };
}

/** Upsert the signed-in user's requirement. Best-effort — returns null on failure. */
export async function saveUserRequirement(user, prefs, extra = {}) {
  const uid = user?.uid || user?.id;
  if (!isSupabaseConfigured || !supabase || !uid) return null;
  try {
    const row = prefsToRow(prefs, user, extra);
    const { data, error } = await supabase
      .from("user_requirements")
      .upsert(row, { onConflict: "user_id" })
      .select()
      .single();
    if (error) { console.error("saveUserRequirement", error); return null; }
    return data;
  } catch (e) {
    console.error("saveUserRequirement", e);
    return null;
  }
}

/** Fetch one user's saved requirement. */
export async function fetchUserRequirement(uid) {
  if (!isSupabaseConfigured || !supabase || !uid) return null;
  const { data, error } = await supabase
    .from("user_requirements")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) return null;
  return data;
}

/** Every user's requirement (for the List my Flat "who does this match" step). */
export async function fetchAllUserRequirements({ limit = 1000 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("user_requirements")
    .select("*")
    .limit(limit);
  if (error) return [];
  return data || [];
}
