import { supabase, isSupabaseConfigured } from "./supabase";

export const EMPTY_SEARCH_PROFILE = {
  preferredAreas: [],
  budgetMin: null,
  budgetMax: null,
  bhk: "",
  propertyType: "",
  furnishing: "",
  moveInDate: "",
  commuteTo: "",
  maxCommuteMins: null,
  mustHaves: "",
  dealBreakers: "",
  pets: "",
  parking: "",
  notes: "",
  priority: "",
};

function toList(value) {
  if (Array.isArray(value)) return value.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 24);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 24);
  }
  return [];
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizeSearchProfile(raw) {
  const r = raw || {};
  const areasInput = r.preferredAreas;
  const preferredAreas =
    typeof areasInput === "string" ? toList(areasInput) : toList(areasInput);
  return {
    preferredAreas,
    budgetMin: numOrNull(r.budgetMin),
    budgetMax: numOrNull(r.budgetMax),
    bhk: String(r.bhk || "").trim().slice(0, 40),
    propertyType: String(r.propertyType || "").trim().slice(0, 80),
    furnishing: String(r.furnishing || "").trim().slice(0, 80),
    moveInDate: String(r.moveInDate || "").trim().slice(0, 40),
    commuteTo: String(r.commuteTo || "").trim().slice(0, 120),
    maxCommuteMins: numOrNull(r.maxCommuteMins),
    mustHaves: String(r.mustHaves || "").trim().slice(0, 500),
    dealBreakers: String(r.dealBreakers || "").trim().slice(0, 500),
    pets: String(r.pets || "").trim().slice(0, 120),
    parking: String(r.parking || "").trim().slice(0, 120),
    notes:     String(r.notes     || "").trim().slice(0, 800),
    priority:  String(r.priority  || "").trim().slice(0, 120),
  };
}

/** Enough for a useful broker intro on WhatsApp. */
export function isSearchProfileComplete(profile) {
  const p = normalizeSearchProfile(profile);
  const hasArea = p.preferredAreas.length > 0;
  const hasBudget = p.budgetMin != null || p.budgetMax != null;
  const hasBrief = Boolean(p.bhk || p.propertyType || p.mustHaves || p.notes);
  return hasArea && (hasBudget || hasBrief);
}

function rowToProfile(row) {
  if (!row) return { ...EMPTY_SEARCH_PROFILE };
  return normalizeSearchProfile({
    preferredAreas: row.preferred_areas,
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    bhk: row.bhk,
    propertyType: row.property_type,
    furnishing: row.furnishing,
    moveInDate: row.move_in_date,
    commuteTo: row.commute_to,
    maxCommuteMins: row.max_commute_mins,
    mustHaves: row.must_haves,
    dealBreakers: row.deal_breakers,
    pets: row.pets,
    parking: row.parking,
    notes: row.notes,
    priority: row.priority,
  });
}

export async function fetchCustomerSearchProfile(uid) {
  if (!isSupabaseConfigured || !supabase || !uid) return { ...EMPTY_SEARCH_PROFILE };
  try {
    const { data, error } = await supabase
      .from("customer_search_profiles")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (error || !data) return { ...EMPTY_SEARCH_PROFILE };
    return rowToProfile(data);
  } catch {
    return { ...EMPTY_SEARCH_PROFILE };
  }
}

export async function saveCustomerSearchProfile(uid, draft) {
  if (!isSupabaseConfigured || !supabase || !uid) throw new Error("Supabase is not configured");
  const profile = normalizeSearchProfile(draft);
  const { error } = await supabase.from("customer_search_profiles").upsert(
    {
      user_id: uid,
      preferred_areas: profile.preferredAreas,
      budget_min: profile.budgetMin,
      budget_max: profile.budgetMax,
      bhk: profile.bhk,
      property_type: profile.propertyType,
      furnishing: profile.furnishing,
      move_in_date: profile.moveInDate,
      commute_to: profile.commuteTo,
      max_commute_mins: profile.maxCommuteMins,
      must_haves: profile.mustHaves,
      deal_breakers: profile.dealBreakers,
      pets: profile.pets,
      parking: profile.parking,
      notes: profile.notes,
      priority: profile.priority,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
  return profile;
}
