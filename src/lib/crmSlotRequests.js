/**
 * Tenants waiting on a visit time.
 *
 * When somebody asks to see a flat that has no slots on it, that ask lands in
 * visit_requests and nothing happens to it. The CRM showed a four-line amber
 * strip on the Clients tab with the notification text and a "Done" button —
 * which cleared the alert without arranging anything, and never said which flat
 * it was about or let anyone answer the person waiting.
 *
 * This is the same queue as data worth acting on: grouped by property, with the
 * people waiting attached, so a screen can show the flat, everyone waiting on
 * it, and the two things that actually resolve it — put times up, or take the
 * flat down.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

/** Pending asks, newest first. Readable by CRM staff (crm_slot_requests.sql). */
export async function fetchPendingSlotRequests({ limit = 500 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("visit_requests")
      .select("id,customer_id,customer_email,customer_phone,listing_id,listing_title,visit_time,notes,status,created_at")
      .eq("status", "pending")
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
export async function resolveSlotRequest(id, status = "scheduled") {
  if (!isSupabaseConfigured || !supabase || !id) return false;
  try {
    const { error } = await supabase.from("visit_requests").update({ status }).eq("id", id);
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
export function groupRequestsByProperty(requests = [], listings = new Map(), slots = new Map()) {
  const byProperty = new Map();

  for (const r of requests) {
    const id = r.listing_id;
    if (!id) continue;
    if (!byProperty.has(id)) {
      byProperty.set(id, {
        propertyId: id,
        listing: listings.get(id) || null,
        // Falls back to whatever the request recorded at the time, so a flat
        // since removed from inventory still shows something readable.
        title: listings.get(id)?.title || r.listing_title || id,
        slots: slots.get(id) || [],
        waiting: [],
      });
    }
    const group = byProperty.get(id);
    // One row per person, not per ask: somebody who asked three times is one
    // person to call back, and three identical rows is three chances to
    // message them three times.
    const key = (r.customer_phone || r.customer_email || r.customer_id || r.id).toString().toLowerCase();
    const seen = group.waiting.find((w) => w.key === key);
    if (seen) {
      seen.asks += 1;
      if (r.notes && !seen.notes) seen.notes = r.notes;
      continue;
    }
    group.waiting.push({
      key,
      id: r.id,
      userId: r.customer_id || null,
      email: r.customer_email || "",
      phone: r.customer_phone || "",
      preferred: r.visit_time || "",
      notes: r.notes || "",
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
