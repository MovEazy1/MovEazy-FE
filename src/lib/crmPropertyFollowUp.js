/**
 * Flats that have been up a while and never been asked about.
 *
 * A listing goes up and stays up. Nothing ever asked the owner whether it was
 * taken, so the board fills with flats let weeks ago — and the person who
 * finds out is a tenant who asked to see one, which costs far more than the
 * listing was worth.
 *
 * The queue is deliberately simple: published, older than a week, and not
 * confirmed in the last week. Working an item records the answer and takes it
 * out until it is due again.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

/** How old a listing must be before it is worth asking about. */
export const STALE_AFTER_DAYS = 7;
/** And how long an answer holds before we ask again. */
export const RECHECK_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What an owner can tell us, and what each answer does to the listing.
 *
 * "Still available" is the only one that leaves it on the site. The other two
 * both take it off, and the difference between them is worth keeping: a flat
 * that was let is a number we want, and a flat whose owner never replied is a
 * different problem with a different fix.
 */
export const FOLLOW_UP_OUTCOMES = [
  { id: "available", label: "Still available", status: null,
    note: "Owner confirmed it is still available" },
  { id: "rented", label: "Rented out", status: "rented",
    note: "Owner said it is rented out" },
  { id: "dormant", label: "No response", status: "dormant",
    note: "No response from the owner" },
];

/** Listings due a check, longest-overdue first. */
export async function fetchDueForFollowUp({ limit = 300, now = Date.now() } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  const staleBefore = new Date(now - STALE_AFTER_DAYS * DAY_MS).toISOString();
  const recheckBefore = new Date(now - RECHECK_AFTER_DAYS * DAY_MS).toISOString();
  try {
    const { data, error } = await supabase
      .from("inventory")
      .select(
        "property_id,title,area,rent,flat_type,furnishing,poster_name,phone," +
          "cover_image_url,images,status,created_at,availability_checked_at,availability_note",
      )
      .eq("status", "published")
      .lt("created_at", staleBefore)
      .or(`availability_checked_at.is.null,availability_checked_at.lt.${recheckBefore}`)
      // Never-asked first, then the longest since anyone asked.
      .order("availability_checked_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Record what the owner said.
 *
 * The timestamp is written whatever the answer, including "still available" —
 * that is what takes the flat out of the queue for another week. Without it,
 * confirming a listing would leave it sitting there and the queue would never
 * empty.
 */
export async function recordFollowUp(propertyId, outcomeId, { note = "" } = {}) {
  const outcome = FOLLOW_UP_OUTCOMES.find((o) => o.id === outcomeId);
  if (!propertyId || !outcome) return false;
  if (!isSupabaseConfigured || !supabase) return false;

  const patch = {
    availability_checked_at: new Date().toISOString(),
    availability_note: note || outcome.note,
    updated_at: new Date().toISOString(),
  };
  // Only an answer that changes what the flat is touches its status. A
  // confirmation should not rewrite a status somebody set by hand.
  if (outcome.status) patch.status = outcome.status;

  try {
    const { error } = await supabase.from("inventory").update(patch).eq("property_id", propertyId);
    return !error;
  } catch {
    return false;
  }
}

/** How long this flat has been up, for the one column that explains the queue. */
export function ageInDays(iso, now = Date.now()) {
  const t = new Date(iso ?? 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

/** "Never asked" or "checked 12 days ago" — why this row is in the list. */
export function checkedLabel(iso, now = Date.now()) {
  const days = ageInDays(iso, now);
  if (days === null) return "Never asked";
  if (days === 0) return "Checked today";
  return `Checked ${days} day${days === 1 ? "" : "s"} ago`;
}

/** What we open WhatsApp with, to the owner, about one flat. */
export function availabilityMessage({ posterName, propertyId, title, area }) {
  const who = String(posterName || "").trim().split(/\s+/)[0];
  const what = [title, area].filter(Boolean).join(", ") || propertyId;
  return [
    `Hi${who ? ` ${who}` : ""}, this is MovEazy.`,
    "",
    `Quick check on your listing — ${what} (${propertyId}).`,
    "Is it still available, or has it been rented out?",
    "Just so we don't send anyone to a flat that's already gone.",
  ].join("\n");
}
