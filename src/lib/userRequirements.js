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
    // commuteMinutes/moveInDate have no columns of their own — they ride
    // inside the same notes jsonb blob the per-step "anything else?" text
    // already uses, so neither preference needs its own migration.
    notes: {
      ...(p.notes && typeof p.notes === "object" ? p.notes : {}),
      commuteMinutes: num(p.commuteMinutes) ?? 30,
      moveInDate: p.moveInDate || "",
    },
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
    commuteMinutes: num(row.notes?.commuteMinutes) ?? 30,
    moveInDate: row.notes?.moveInDate || "",
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

/**
 * Marks that this account has been shown the one-time "top 5 matches" swipe
 * screen, so the next time they'd land there they go straight to the map
 * instead. Best-effort and silent: if the matches_seen migration hasn't run
 * yet, this just fails quietly and they keep seeing the swipe screen — never
 * something worth breaking the page over.
 */
export async function markMatchesSeen(uid) {
  if (!isSupabaseConfigured || !supabase || !uid) return;
  try {
    await supabase.from("user_requirements").update({ matches_seen: true }).eq("user_id", uid);
  } catch {
    // ignore — see comment above
  }
}

/**
 * Sets the account-level deadline for the "our team is curating your
 * shortlist" countdown, but only the first time — it rides in the same
 * notes jsonb blob as commuteMinutes, so it survives across devices and
 * browsers (unlike a localStorage timer) and never gets pushed forward by
 * a later visit. `currentNotes` is whatever the caller already has loaded,
 * so this doesn't need its own read before the write.
 */
export async function persistShortlistDeadline(uid, currentNotes, deadline) {
  if (!isSupabaseConfigured || !supabase || !uid) return;
  try {
    const notes = { ...(currentNotes && typeof currentNotes === "object" ? currentNotes : {}), shortlistDeadline: deadline };
    await supabase.from("user_requirements").update({ notes }).eq("user_id", uid);
  } catch {
    // best-effort — see markMatchesSeen above
  }
}

/**
 * Flags, for the CRM, that this account asked for more homes after going
 * through a shortlist — read into notes.requestedMoreFlatsAt so it shows up
 * next to the rest of what the client told us without an agent having to
 * dig through a WhatsApp thread for it. A rare, one-off tap rather than a hot
 * path, so unlike persistShortlistDeadline this reads the row first instead
 * of asking the caller to already have it loaded.
 */
export async function persistRequestedMoreFlats(uid) {
  if (!isSupabaseConfigured || !supabase || !uid) return;
  try {
    const { data } = await supabase.from("user_requirements").select("notes").eq("user_id", uid).maybeSingle();
    const notes = {
      ...(data?.notes && typeof data.notes === "object" ? data.notes : {}),
      requestedMoreFlatsAt: new Date().toISOString(),
    };
    await supabase.from("user_requirements").update({ notes }).eq("user_id", uid);
  } catch {
    // best-effort — see markMatchesSeen above
  }
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
