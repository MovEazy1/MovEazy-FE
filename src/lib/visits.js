import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Site-visit + reactions data layer.
 * - Reactions: like/dislike per listing (listing_reactions).
 * - Slots: admin-entered availability per property (property_visit_slots).
 * - Bookings: scheduled visits, individual (free) or combined ₹1000 (visit_bookings).
 */

/* ── Reactions ─────────────────────────────────────────────────────────────── */
export async function fetchReactions(uid) {
  if (!isSupabaseConfigured || !supabase || !uid) return {};
  const { data, error } = await supabase.from("listing_reactions").select("property_id, reaction").eq("user_id", uid);
  if (error) return {};
  return Object.fromEntries((data || []).map((r) => [r.property_id, r.reaction]));
}

/** Toggle a reaction. Clicking the same reaction again clears it. Returns the new value ('like'|'dislike'|null). */
export async function setReaction(uid, propertyId, reaction, current) {
  if (!isSupabaseConfigured || !supabase || !uid) return current ?? null;
  if (current === reaction) {
    await supabase.from("listing_reactions").delete().eq("user_id", uid).eq("property_id", propertyId);
    return null;
  }
  await supabase.from("listing_reactions").upsert(
    { user_id: uid, property_id: propertyId, reaction, updated_at: new Date().toISOString() },
    { onConflict: "user_id,property_id" }
  );
  return reaction;
}

/* ── Visit slots (admin-entered) ───────────────────────────────────────────── */
/** { [property_id]: [{id, slot_at, capacity}] } for the given properties, future slots only. */
export async function fetchSlotsFor(propertyIds = []) {
  if (!isSupabaseConfigured || !supabase || !propertyIds.length) return {};
  const { data, error } = await supabase
    .from("property_visit_slots")
    .select("id, property_id, slot_at, capacity")
    .in("property_id", propertyIds)
    .gt("slot_at", new Date().toISOString())
    .order("slot_at", { ascending: true });
  if (error) return {};
  const out = {};
  for (const s of data || []) (out[s.property_id] ||= []).push(s);
  return out;
}

/**
 * What a renter is actually offered to book: open visit slots within the next
 * `days` days (default 7), not every slot an owner has ever set up. Same
 * shape as fetchSlotsFor — { [property_id]: [slot, ...] } — just bounded, so
 * a far-future custom date doesn't show up as bookable months in advance.
 */
export async function fetchOpenVisitsFor(propertyIds = [], { days = 7 } = {}) {
  if (!isSupabaseConfigured || !supabase || !propertyIds.length) return {};
  const now = new Date();
  const until = new Date(now.getTime() + days * 86400000);
  const { data, error } = await supabase
    .from("property_visit_slots")
    .select("id, property_id, slot_at, capacity")
    .in("property_id", propertyIds)
    .gt("slot_at", now.toISOString())
    .lte("slot_at", until.toISOString())
    .order("slot_at", { ascending: true });
  if (error) return {};
  const out = {};
  for (const s of data || []) (out[s.property_id] ||= []).push(s);
  return out;
}

/** Open visit slots for one property within the next `days` days (default 7). */
export async function fetchOpenVisitsForProperty(propertyId, opts = {}) {
  const map = await fetchOpenVisitsFor([propertyId], opts);
  return map[propertyId] || [];
}

/** Whether any of these properties has at least one upcoming open visit slot —
 * used to nudge an owner who hasn't set visit timing for anything yet. Not
 * limited to the 5-day window fetchSlotsFor's callers usually care about, so
 * it stays accurate even if every slot is further out than that. */
export async function hasAnyOpenSlot(propertyIds = []) {
  if (!isSupabaseConfigured || !supabase || !propertyIds.length) return false;
  const { count, error } = await supabase
    .from("property_visit_slots")
    .select("id", { count: "exact", head: true })
    .in("property_id", propertyIds)
    .gt("slot_at", new Date().toISOString());
  if (error) return false;
  return (count || 0) > 0;
}

/* ── Admin slot management ─────────────────────────────────────────────────── */
/** All upcoming slots for one property (admin editor). */
export async function fetchSlotsForProperty(propertyId) {
  const map = await fetchSlotsFor([propertyId]);
  return map[propertyId] || [];
}

/** Add a visit slot (admin only — enforced by RLS is_admin_allowlisted()). */
export async function addVisitSlot(propertyId, slotAtISO, capacity = 5) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("property_visit_slots")
    .insert({ property_id: propertyId, slot_at: slotAtISO, capacity: Number(capacity) || 5 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVisitSlot(id) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("property_visit_slots").delete().eq("id", id);
  if (error) throw error;
}

/* ── Bookings ──────────────────────────────────────────────────────────────── */
export async function fetchBookings(uid) {
  if (!isSupabaseConfigured || !supabase || !uid) return [];
  const { data, error } = await supabase.from("visit_bookings").select("*").eq("user_id", uid);
  if (error) return [];
  return data || [];
}

/** Schedule (or reschedule) a single-property visit at a chosen slot. */
export async function bookIndividual(uid, propertyId, slotAt) {
  if (!isSupabaseConfigured || !supabase || !uid) throw new Error("Not signed in");
  const { error } = await supabase.from("visit_bookings").upsert(
    { user_id: uid, property_id: propertyId, slot_at: slotAt, kind: "individual", group_id: null, amount: 0, status: "scheduled" },
    { onConflict: "user_id,property_id" }
  );
  if (error) throw error;
}

/**
 * Book a combined "view all at once" tour across several properties at one shared
 * time. Rows share a group_id and carry the ₹1000 upfront (refundable) fee.
 */
export async function bookCombined(uid, propertyIds, slotAt, { fee = 1000 } = {}) {
  if (!isSupabaseConfigured || !supabase || !uid) throw new Error("Not signed in");
  const groupId = crypto.randomUUID();
  const rows = propertyIds.map((pid, i) => ({
    user_id: uid, property_id: pid, slot_at: slotAt, kind: "combined", group_id: groupId,
    amount: i === 0 ? fee : 0, status: "scheduled",
  }));
  const { error } = await supabase.from("visit_bookings").upsert(rows, { onConflict: "user_id,property_id" });
  if (error) throw error;
  return groupId;
}

/** Cancel a scheduled visit (keeps the listing in the cart, back to "to schedule"). */
export async function cancelBooking(uid, propertyId) {
  if (!isSupabaseConfigured || !supabase || !uid) return;
  await supabase.from("visit_bookings").delete().eq("user_id", uid).eq("property_id", propertyId);
}
