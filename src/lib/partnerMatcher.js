/**
 * The AI matcher's memory (MovEazy-BE/supabase/partner_matcher_history.sql):
 * every tenant a broker works — their own clients and the MovEazy tenants
 * assigned to them — what each was sent and liked, the flats never to suggest
 * again, and the visits fixed for them.
 *
 * A tenant's key is "lead:<id>" (the broker's own client) or "asg:<id>" (a
 * MovEazy assignment) — the same keys partner_matcher_seen() returns.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { hasRequirement, matchesForLead, scoreLeadMatch } from "./partnerMatch";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

const who = (t) => ({
  p_lead: t.kind === "moveazy" ? null : t.lead_id ?? t.id,
  p_assignment: t.kind === "moveazy" ? t.assignment_id : null,
});

export const sendCuratedTo = (tenant, propertyIds) =>
  rpc("partner_curated_send", { ...who(tenant), p_properties: propertyIds });
export const fetchMatcherSeen = () => rpc("partner_matcher_seen").then((r) => r ?? {});
export const setVisit = (tenant, propertyId, at) =>
  rpc("partner_visit_set", { ...who(tenant), p_property: propertyId, p_at: new Date(at).toISOString() });
export const cancelVisit = (visitId) => rpc("partner_visit_cancel", { p_visit: visitId });
export const fetchMyVisits = () => rpc("partner_visits_mine").then((r) => r ?? []);
/** Today's visits; the first call of the day also drops the reminder in the bell. */
export const fetchTodaysVisits = () => rpc("partner_visits_today").then((r) => r ?? []);

/** Below the match bar but still worth a look: in their area or their BHK. */
export const NEAR_MIN = 45;
export const FRESH_COUNT = 10;
const CLOSED_ASSIGNMENT = new Set(["closed", "not_interested"]);

/** "lead:<id>" ↔ the URL's "lead-<id>". */
export const keyToSlug = (key) => String(key || "").replace(":", "-");
export const slugToKey = (slug) => String(slug || "").replace(/^(lead|asg)-/, "$1:");

/** Every tenant the matcher works on: MovEazy's (still open) first, then the broker's own. */
export function matcherTenants(leads = [], assigned = []) {
  const mz = assigned.filter((a) => !CLOSED_ASSIGNMENT.has(a.status)).map((a) => ({
    id: `asg-${a.id}`,
    key: `asg:${a.id}`,
    kind: "moveazy",
    assignment_id: a.id,
    assignment_status: a.status,
    name: a.name || "MovEazy tenant",
    phone: a.phone || "",
    localities: a.localities ?? [],
    flat_types: a.flat_types ?? [],
    occupants: a.occupants ?? [],
    budget_min: a.budget_min,
    budget_max: a.budget_max,
    furnishing: "",
    move_in: a.move_in,
    move_in_raw: a.move_in_raw,
    status: "active",
  }));
  const own = leads.filter((l) => l.status !== "closed").map((l) => ({ ...l, kind: "own", lead_id: l.id, key: `lead:${l.id}` }));
  return [...mz, ...own];
}

/** The lists this broker sent one tenant, newest first. */
export function listsFor(tenant, lists = []) {
  return lists
    .filter((l) => (tenant.kind === "moveazy" ? l.assignment_id === tenant.assignment_id : l.lead_id && l.lead_id === tenant.lead_id))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/** Every flat a tenant liked across those lists, latest like first, once each. */
export function likedFlats(lists = []) {
  const by = new Map();
  for (const l of lists) {
    for (const pid of l.property_ids ?? []) {
      const a = l.actions?.[pid];
      if (a?.action !== "liked") continue;
      const cur = by.get(pid);
      if (!cur || String(a.at) > String(cur.at)) by.set(pid, { property_id: pid, at: a.at, list_id: l.id });
    }
  }
  return [...by.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** Fresh: never sent a list by this broker. Existing: sent at least one. */
export function splitTenants(tenants = [], lists = []) {
  const fresh = [];
  const existing = [];
  for (const t of tenants) (listsFor(t, lists).length ? existing : fresh).push(t);
  return { fresh, existing };
}

const isLive = (l) => !l.status || l.status === "published";

/**
 * The next `n` flats for a tenant, never one in `exclude`. Strong matches
 * first; if they run short, the closest near-matches still in their area (or
 * their BHK) — each marked `near`. → { picks, strong, near, total }, `total`
 * being every strong match still unsent.
 */
export function freshPicks(lead, listings = [], exclude = new Set(), n = FRESH_COUNT) {
  if (!hasRequirement(lead)) return { picks: [], strong: 0, near: 0, total: 0 };
  const pool = listings.filter((l) => isLive(l) && !exclude.has(l.property_id));
  const strong = matchesForLead(lead, pool);
  if (strong.length >= n) return { picks: strong.slice(0, n), strong: n, near: 0, total: strong.length };

  const statedArea = (lead.localities ?? []).length > 0;
  const statedBhk = (lead.flat_types ?? []).length > 0;
  const nearOk = (m) =>
    (statedArea && m.hits.location) || (statedBhk && m.hits.bhk) || (!statedArea && !statedBhk && m.hits.budget);
  const have = new Set(strong.map((m) => m.listing.property_id));
  const near = pool
    .filter((l) => !have.has(l.property_id))
    .map((listing) => ({ listing, ...scoreLeadMatch(listing, lead), near: true }))
    .filter((m) => m.score >= NEAR_MIN && nearOk(m))
    .sort((a, b) => b.score - a.score);
  const picks = [...strong, ...near].slice(0, n);
  return { picks, strong: strong.length, near: picks.length - strong.length, total: strong.length };
}

/** "2 BHK · HSR Layout · ₹40,000" */
export function flatLine(l) {
  if (!l) return "";
  const rent = Number(l.rent) > 0 ? `₹${Number(l.rent).toLocaleString("en-IN")}` : "";
  return [l.flat_type || (l.bedrooms ? `${l.bedrooms} BHK` : ""), l.area, rent].filter(Boolean).join(" · ");
}

/** The WhatsApp that turns likes into visits. */
export function visitsMessage(name, flats = []) {
  const first = String(name || "").trim().split(/\s+/)[0];
  const lines = flats.map((l, i) => `${i + 1}. ${flatLine(l)}`).join("\n");
  return `Hi${first ? ` ${first}` : ""}, you liked ${flats.length === 1 ? "this home" : "these homes"}:\n${lines}\n`
    + "When would you like to see them? Tell me a day and time and I'll fix the visits.";
}

/** "Tue 14 Oct, 5:00 pm" in IST. */
export function visitLabel(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}
