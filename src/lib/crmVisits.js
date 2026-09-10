/**
 * Booked visits, as the CRM needs them.
 *
 * A visit is a row in `visit_bookings` — written by the renter, never by us.
 * What the CRM adds is the follow-up: who is going where and when, and whether
 * anyone has told them. Reads are defensive like the rest of crmClients; writes
 * are not, because an agent who thinks a reminder went out and it didn't is
 * worse off than one who sees an error.
 *
 * Needs MovEazy-BE/supabase/crm_visits_access.sql: without it the staff select
 * policy doesn't exist and this returns an empty list rather than failing.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

/* ── When a message is due ────────────────────────────────────────────────── */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

/** A reminder is due inside the last day before the visit. */
export const REMINDER_WINDOW_MS = DAY_MS;
/** A confirmation is due in the last two hours. */
export const CONFIRM_WINDOW_MS = 2 * HOUR_MS;

/**
 * What the CRM should be doing about this visit right now.
 *
 * `none` — too far out, or already past.
 * `reminder` — inside 24 hours, outside 2.
 * `confirm` — inside 2 hours.
 *
 * A visit with no time can't be either: it needs a human to arrange one first.
 */
export function dueState(booking, now = Date.now()) {
  const at = booking?.slot_at ? new Date(booking.slot_at).getTime() : NaN;
  if (!Number.isFinite(at)) return "unscheduled";
  const until = at - now;
  if (until <= 0) return "past";
  if (until <= CONFIRM_WINDOW_MS) return "confirm";
  if (until <= REMINDER_WINDOW_MS) return "reminder";
  return "none";
}

/**
 * Visits soonest first; unscheduled ones lead, because they're the ones that
 * need a human before they need attending.
 *
 * `timeOf` exists because callers hold two shapes: the raw booking, and a row
 * that has joined the client and the listing onto it. Reading `.slot_at` off
 * the second silently sorts nothing at all.
 */
export function sortForAgenda(rows = [], timeOf = (r) => r?.slot_at) {
  return [...rows].sort((a, b) => {
    const at = timeOf(a) ? new Date(timeOf(a)).getTime() : -Infinity;
    const bt = timeOf(b) ? new Date(timeOf(b)).getTime() : -Infinity;
    return at - bt;
  });
}

/** Local calendar day, so an 11pm visit doesn't land on tomorrow's list. */
export function dayKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Group visits under a key, dropping empty groups and keeping each group's
 * rows in agenda order. `""` collects everything the key can't place — an
 * unscheduled visit, a booking whose client row hasn't been created.
 */
export function groupBy(rows = [], keyOf, timeOf = (r) => r?.slot_at) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r) ?? "";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].map(([key, items]) => ({ key, items: sortForAgenda(items, timeOf) }));
}

/* ── Reads ────────────────────────────────────────────────────────────────── */

export async function fetchVisitBookings({ sinceDays = 30, limit = 2000 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  // Reach back a month: a visit that already happened is still the thing an
  // agent is chasing an outcome on.
  const since = new Date(Date.now() - sinceDays * DAY_MS).toISOString();
  try {
    const { data, error } = await supabase
      .from("visit_bookings")
      .select(
        "id,user_id,property_id,slot_at,kind,status,amount,created_at," +
          "reminder_sent_at,reminder_sent_by,confirmation_sent_at,confirmation_sent_by",
      )
      .or(`slot_at.gte.${since},slot_at.is.null`)
      .order("slot_at", { ascending: true })
      .limit(limit);
    if (error) {
      console.warn(`[crm] visit_bookings: ${error.message}`);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.warn(`[crm] visit_bookings threw: ${e?.message}`);
    return [];
  }
}

/**
 * Names and numbers for people who booked a visit but have no crm_clients row
 * yet — which is everyone, until crm_visit_sync.sql is running.
 */
export async function fetchProfilesFor(userIds = []) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length || !isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("user_profiles").select("id,name,email,phone").in("id", ids);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/* ── Writes ───────────────────────────────────────────────────────────────── */

async function stamp(bookingId, patch) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("visit_bookings").update(patch).eq("id", bookingId).select().single();
  if (error) throw error;
  return data;
}

/**
 * Record that a reminder went out. Called after the WhatsApp window opens —
 * we can't know the agent pressed send, only that they were handed the message,
 * so the UI says "marked" rather than "delivered".
 */
export const markReminderSent = (bookingId, actorEmail = "") =>
  stamp(bookingId, { reminder_sent_at: new Date().toISOString(), reminder_sent_by: actorEmail });

export const markConfirmationSent = (bookingId, actorEmail = "") =>
  stamp(bookingId, { confirmation_sent_at: new Date().toISOString(), confirmation_sent_by: actorEmail });

/** Clear a stamp — an agent who marked the wrong row shouldn't be stuck with it. */
export const clearReminderSent = (bookingId) =>
  stamp(bookingId, { reminder_sent_at: null, reminder_sent_by: null });
export const clearConfirmationSent = (bookingId) =>
  stamp(bookingId, { confirmation_sent_at: null, confirmation_sent_by: null });

/* ── Counting, for the tab badge and the header ───────────────────────────── */

export function summariseVisits(bookings = [], now = Date.now()) {
  const states = bookings.map((b) => dueState(b, now));
  return {
    total: bookings.length,
    upcoming: states.filter((s) => s === "none" || s === "reminder" || s === "confirm").length,
    remindersDue: bookings.filter(
      (b, i) => states[i] === "reminder" && !b.reminder_sent_at,
    ).length,
    confirmsDue: bookings.filter(
      (b, i) => states[i] === "confirm" && !b.confirmation_sent_at,
    ).length,
    unscheduled: states.filter((s) => s === "unscheduled").length,
    past: states.filter((s) => s === "past").length,
  };
}
