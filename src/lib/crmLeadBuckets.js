/**
 * Which clients are leads, which of them nobody has spoken to yet, and where
 * each of the rest has got to.
 *
 * The Clients tab splits into Fresh leads (a number, and no contact from us)
 * and Contacted leads (filtered by how far along they are). Everything here is
 * derived from what the CRM already loads — nothing is stored — so it is right
 * for every existing client the moment it ships, and there is no second copy
 * of "contacted" to fall out of step with the evidence.
 */
import { hasStatedRequirement } from "./crmPropertyInterest";

/**
 * Staff activity that means someone from MovEazy actually reached out.
 *
 * Deliberately not every staff activity. A note can be "number looks fake",
 * a temperature is a judgement that can be made from browsing alone, and
 * "system" is the CRM talking to itself — none of those is contact.
 *
 * Status changes do count, but only as a *staff activity*: crm_clients.status
 * on its own is not evidence, because the visit-booking trigger moves a client
 * to "1 visit + pending" by itself with nobody from the team involved.
 */
export const CONTACT_ACTIVITY_TYPES = new Set(["whatsapp", "call", "shortlist", "status", "contacted"]);

/** The manual mark. Logged as an activity so it carries who and when. */
export const MARK_CONTACTED_TYPE = "contacted";

/** Days without contact from us before a contacted lead counts as going quiet. */
export const QUIET_AFTER_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED = new Set(["closed_by_us", "closed_outside"]);

/**
 * How far a contacted lead has got, furthest last. Mutually exclusive: each
 * client sits at the furthest stage they have reached, so the counts add up to
 * the tab and a client never appears under two.
 */
export const LEAD_STAGES = [
  { id: "no_prefs", label: "Prefs not filled", hint: "Never told us what they want" },
  { id: "prefs_no_shortlist", label: "Prefs filled · nothing sent", hint: "We know what they want and haven't sent a flat yet" },
  { id: "shortlisted_unseen", label: "Sent · not seen", hint: "We've sent flats; they haven't opened any" },
  { id: "shortlisted_seen", label: "Sent · seen", hint: "They've opened what we sent" },
  { id: "engaged", label: "Liked / visit booked", hint: "At least one like or a visit" },
];

export const FRESH_SORTS = [
  { id: "site", label: "Latest on website" },
  { id: "newest", label: "Newest lead" },
];

export const CONTACTED_SORTS = [
  { id: "site", label: "Latest action on website" },
  { id: "deadline", label: "Shortlist due soonest" },
  { id: "move_in", label: "Earliest move-in" },
  { id: "quiet", label: "Longest since we contacted" },
];

const ts = (v) => {
  if (v == null || v === "") return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

export const hasPhone = (c) => String(c?.phone ?? "").replace(/\D/g, "").length >= 10;

const hasList = (v) => Array.isArray(v) && v.length > 0;

/** Did they tell us anything themselves, or has an agent recorded it for them? */
function prefsFilled({ req, own, lead }) {
  if (hasStatedRequirement(req)) return true;
  // Same caution for the saved wizard answers: flat types arrive pre-ticked.
  if (own && (hasList(own.localities) || own.budget_max)) return true;
  if (lead) {
    if (lead.completed) return true;
    // Localities only. The questionnaire starts with every flat type ticked
    // and a budget already filled in, so those hold values the moment it is
    // opened — they would mark everyone who glanced at it as having answered.
    const p = lead.prefs && typeof lead.prefs === "object" ? lead.prefs : {};
    if (hasList(p.localities)) return true;
  }
  return false;
}

/**
 * Sent by us: a shortlist row the team shared. Not every crm_shortlists row
 * is one — the booking trigger writes rows for flats the client booked
 * themselves, and "shortlisted" is an agent's working list before sending.
 */
const wasSent = (s) => Boolean(s.shared_at || s.shared_by || s.curated_share_id);
const wasSeen = (s) =>
  Boolean(s.opened_at || s.last_opened_at || s.reacted_at) ||
  ["liked", "okay", "disliked", "visited", "visit_scheduled"].includes(s.status);
const isEngagedRow = (s) => ["liked", "visited", "visit_scheduled"].includes(s.status);

/**
 * Index every source by client once, then summarise each client.
 *
 * sources:
 *   activities   crm_activities rows: client_id, actor_email, type, created_at
 *   shortlists   crm_shortlists rows
 *   engagement   user_engagement rows (by user_id)
 *   ownAnswers   user_requirements rows (by user_id)
 *   leads        crm_lead_intake rows (by crm_client_id)
 *   requirements crm_client_requirements rows (by client_id)
 *   interest     crm_client_property_interest rows (by client_id)
 */
export function summariseClients(clients = [], sources = {}, now = Date.now()) {
  const group = (rows, key) => {
    const m = new Map();
    for (const r of rows ?? []) {
      const k = r?.[key];
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  };
  const one = (rows, key) => {
    const m = new Map();
    for (const r of rows ?? []) if (r?.[key] && !m.has(r[key])) m.set(r[key], r);
    return m;
  };

  const actsBy = group(sources.activities, "client_id");
  const listsBy = group(sources.shortlists, "client_id");
  const interestBy = group(sources.interest, "client_id");
  const engBy = one(sources.engagement, "user_id");
  const ownBy = one(sources.ownAnswers, "user_id");
  const reqBy = one(sources.requirements, "client_id");
  // A client can have several lead rows (two browsers); the newest speaks.
  const leadBy = new Map();
  for (const l of sources.leads ?? []) {
    if (!l?.crm_client_id) continue;
    const cur = leadBy.get(l.crm_client_id);
    if (!cur || ts(l.updated_at) > ts(cur.updated_at)) leadBy.set(l.crm_client_id, l);
  }

  const out = new Map();
  for (const c of clients) {
    const acts = actsBy.get(c.id) ?? [];
    const lists = listsBy.get(c.id) ?? [];
    const signals = interestBy.get(c.id) ?? [];
    const eng = c.user_id ? engBy.get(c.user_id) : null;
    const own = c.user_id ? ownBy.get(c.user_id) : null;
    const req = reqBy.get(c.id) ?? null;
    const lead = leadBy.get(c.id) ?? null;

    // ── Contact from us ──
    const staffContacts = acts.filter((a) => String(a.actor_email ?? "").trim() && CONTACT_ACTIVITY_TYPES.has(a.type));
    const sent = lists.filter(wasSent);
    const markedAt = Math.max(0, ...staffContacts.filter((a) => a.type === MARK_CONTACTED_TYPE).map((a) => ts(a.created_at)));
    const lastContactAt = Math.max(
      0,
      ...staffContacts.map((a) => ts(a.created_at)),
      ...sent.map((s) => ts(s.shared_at)),
    );
    const contacted = staffContacts.length > 0 || sent.length > 0;

    // ── Their own activity on the site ──
    // Never crm_clients.updated_at: staff edits bump it, so an agent fixing a
    // name would float the lead to the top as if they had just visited.
    const lastSiteActionAt = Math.max(
      0,
      ...acts.filter((a) => !String(a.actor_email ?? "").trim()).map((a) => ts(a.created_at)),
      ts(eng?.last_seen_at),
      ts(lead?.updated_at),
      ts(own?.updated_at),
      ...lists.map((s) => Math.max(ts(s.last_opened_at), ts(s.opened_at), ts(s.reacted_at))),
      ...signals.map((s) => ts(s.at)),
    ) || ts(c.created_at);

    // ── Stage ──
    const engaged =
      signals.some((s) => s.signal === "liked" || s.signal === "booked") ||
      lists.some(isEngagedRow) ||
      c.status === "visit_pending";
    let stage;
    if (engaged) stage = "engaged";
    else if (sent.some(wasSeen)) stage = "shortlisted_seen";
    else if (sent.length) stage = "shortlisted_unseen";
    else if (prefsFilled({ req, own, lead })) stage = "prefs_no_shortlist";
    else stage = "no_prefs";

    const closed = CLOSED.has(c.status);
    out.set(c.id, {
      hasPhone: hasPhone(c),
      contacted,
      markedContacted: markedAt > 0,
      lastContactAt,
      lastSiteActionAt,
      stage,
      closed,
      quiet: contacted && !closed && lastContactAt > 0 && now - lastContactAt >= QUIET_AFTER_DAYS * DAY_MS,
    });
  }
  return out;
}

/**
 * Which tab a client belongs in.
 *
 * A lead is somebody with a number — signing in alone never makes one. Anyone
 * we have contacted is Contacted whatever their number says, because the
 * conversation already exists. Everyone else without a number is kept apart,
 * visible but out of both lead lists.
 */
export function bucketOf(summary) {
  if (!summary) return "no_number";
  if (summary.contacted) return "contacted";
  if (summary.hasPhone) return "fresh";
  return "no_number";
}

/** "15 Oct 2026" and "ASAP" both mean something; only the first can be sorted. */
export function moveInTs(raw) {
  const v = String(raw || "").trim();
  if (!v) return Number.POSITIVE_INFINITY;
  const t = Date.parse(v);
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER - 1 : t;
}

/** When the curated shortlist promised on the site is due; unset sorts last. */
export function shortlistDueTs(notes) {
  const v = notes?.shortlistDeadline;
  if (!v) return Number.POSITIVE_INFINITY;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/**
 * Sort one tab's clients.
 *
 * ctx supplies what a sort needs beyond the summary: moveIn(c) and due(c),
 * each returning a timestamp (Infinity for "not set", so unknowns sink).
 */
export function sortClients(rows, sortId, summaries, ctx = {}) {
  const s = (c) => summaries.get(c.id) ?? {};
  const byNewest = (a, b) => ts(b.created_at) - ts(a.created_at);
  const out = [...rows];
  out.sort((a, b) => {
    switch (sortId) {
      case "newest":
        return byNewest(a, b);
      case "deadline":
        return (ctx.due?.(a) ?? Infinity) - (ctx.due?.(b) ?? Infinity) || s(b).lastSiteActionAt - s(a).lastSiteActionAt;
      case "move_in":
        return (ctx.moveIn?.(a) ?? Infinity) - (ctx.moveIn?.(b) ?? Infinity) || s(b).lastSiteActionAt - s(a).lastSiteActionAt;
      case "quiet":
        // Oldest contact first — the lead most likely to have been forgotten.
        return (s(a).lastContactAt || 0) - (s(b).lastContactAt || 0);
      case "site":
      default:
        return (s(b).lastSiteActionAt || 0) - (s(a).lastSiteActionAt || 0) || byNewest(a, b);
    }
  });
  return out;
}

/** "3h ago", "2d ago" — for the line under a lead's name. */
export function agoLabel(t, now = Date.now()) {
  if (!t) return "";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
