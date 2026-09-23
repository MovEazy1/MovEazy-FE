/**
 * Tenants waiting on a visit time.
 *
 * A booking with no slot_at is somebody who asked for "the next available
 * slot" on a flat whose lister has published no times — see the comment in
 * crm_visit_sync.sql, which is what raises the alert. They are the ones
 * needing a human to arrange a time rather than just to turn up.
 *
 * That queue used to be a four-line amber strip on the Clients tab: the
 * notification text, and a "Done" button that cleared the alert without
 * arranging anything. It never said which flat, never showed it, and gave
 * nobody a way to answer the person waiting.
 *
 * This is the same queue as data worth acting on: grouped by property, with
 * the people waiting attached, so a screen can show the flat, everyone waiting
 * on it, and the two things that resolve it — put times up, or take the flat
 * down.
 *
 * Reads visit_bookings, which CRM staff already have rights to
 * (crm_visits_access.sql). There is no visit_requests table in this database;
 * customer_schema.sql declares one, but it was never applied.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

/** Not cancelled, and never given a time. Newest first. */
export async function fetchPendingSlotRequests({ limit = 500 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("visit_bookings")
      .select("id,user_id,property_id,slot_at,kind,status,created_at")
      .is("slot_at", null)
      .not("status", "in", "(cancelled,done)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/** Which of these properties already have visit times on them. */
export async function fetchSlotsFor(propertyIds = []) {
  const ids = [...new Set(propertyIds.filter(Boolean))];
  if (!ids.length || !isSupabaseConfigured || !supabase) return new Map();
  try {
    const { data, error } = await supabase
      .from("property_visit_slots")
      .select("property_id,slot_at,capacity")
      .in("property_id", ids)
      // Times already past do not resolve anybody's request.
      .gte("slot_at", new Date().toISOString())
      .order("slot_at", { ascending: true });
    if (error) return new Map();
    const out = new Map();
    for (const row of data ?? []) {
      if (!out.has(row.property_id)) out.set(row.property_id, []);
      out.get(row.property_id).push(row);
    }
    return out;
  } catch {
    return new Map();
  }
}

/**
 * Stop a request from showing as waiting.
 *
 * Marked rather than deleted: the ask is a real thing that happened, and the
 * Visits screen and the client's own timeline still read it.
 */
export async function resolveSlotRequest(id, status = "cancelled") {
  if (!isSupabaseConfigured || !supabase || !id) return false;
  try {
    const { error } = await supabase.from("visit_bookings").update({ status }).eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * One card per flat, with everyone waiting on it.
 *
 * Grouped this way because that is how the work is done: a flat needs times put
 * on it once, not once per person waiting, and seeing four people against one
 * address is the argument for doing it now.
 */
export function groupRequestsByProperty(requests = [], listings = new Map(), slots = new Map(), profiles = new Map()) {
  const byProperty = new Map();

  for (const r of requests) {
    const id = r.property_id;
    if (!id) continue;
    if (!byProperty.has(id)) {
      byProperty.set(id, {
        propertyId: id,
        listing: listings.get(id) || null,
        // Falls back to whatever the request recorded at the time, so a flat
        // since removed from inventory still shows something readable.
        title: listings.get(id)?.title || id,
        slots: slots.get(id) || [],
        waiting: [],
      });
    }
    const group = byProperty.get(id);
    // One row per person, not per ask: somebody who asked three times is one
    // person to call back, and three identical rows is three chances to
    // message them three times.
    // The booking carries only a user_id; the name and number come from the
    // profile, which is what an agent needs to open a message.
    const who = profiles.get(r.user_id) || {};
    const key = (who.phone || who.email || r.user_id || r.id).toString().toLowerCase();
    const seen = group.waiting.find((w) => w.key === key);
    if (seen) {
      seen.asks += 1;
      continue;
    }
    group.waiting.push({
      key,
      id: r.id,
      userId: r.user_id || null,
      name: who.name || "",
      email: who.email || "",
      phone: who.phone || "",
      preferred: "",
      notes: "",
      askedAt: r.created_at,
      asks: 1,
    });
  }

  // Most people waiting first — that is the flat where putting times up does
  // the most good.
  return [...byProperty.values()].sort(
    (a, b) => b.waiting.length - a.waiting.length || String(a.propertyId).localeCompare(String(b.propertyId)),
  );
}

/** What we send someone who is waiting and has no time to pick yet. */
export function askPreferredTimeMessage({ name, title, propertyId }) {
  const who = String(name || "").trim().split(/\s+/)[0];
  return [
    `Hi${who ? ` ${who}` : ""}, this is MovEazy.`,
    "",
    `You asked to visit ${title || propertyId}.`,
    "What day and time suit you best? Reply here and we'll arrange it with the owner.",
  ].join("\n");
}

/** And what we send once there are times to pick from. */
export function slotsAvailableMessage({ name, title, propertyId, slots = [], link = "" }) {
  const who = String(name || "").trim().split(/\s+/)[0];
  const when = slots.slice(0, 3).map((s) => `• ${formatSlot(s.slot_at)}`);
  return [
    `Hi${who ? ` ${who}` : ""}, good news — visit times are open for ${title || propertyId}.`,
    "",
    ...(when.length ? [...when, ""] : []),
    link ? `Book the one that suits you: ${link}` : "Reply with the one that suits you and we'll confirm it.",
  ].join("\n");
}

/** "Tue 24 Sep, 3:00 pm" — how a time reads in a message, not in a table. */
export function formatSlot(iso) {
  // new Date(null) is the epoch, not an error — without this guard a missing
  // slot_at would go out to a tenant as "Thu, 1 Jan, 5:30 am".
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}
