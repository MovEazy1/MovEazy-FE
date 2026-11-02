/**
 * Daily follow-ups (MovEazy-BE crm_follow_ups.sql): every active client on
 * one list, every call ending in an outcome and a next date, partners
 * assigned from any client, their side held to 24 / 48 hours and scored.
 *
 *   Active      not closed, not Ice.
 *   Due         their follow-up date is today or past; with no date, 2 days
 *               since we last reached them (or never) — lib/crmPriority.js.
 *   Quiet       nothing at all for 7 days — no contact, no visit to the site:
 *               keep (pick a date), Ice, or close.
 *
 * The partner app's Today list reads the same outcomes (partnerBucket).
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { CONTACT_ACTIVITY_TYPES } from "./crmLeadBuckets";
import { DAY, followUp } from "./crmPriority";

export const QUIET_DAYS = 7;
const CLOSED = new Set(["closed_by_us", "closed_outside"]);

/**
 * What a call can end in, and the next date it suggests (days from now, at
 * 10:00; null = pick one; "none" = no next date, the search is over).
 */
export const OUTCOMES = [
  { id: "talked", label: "Talked", next: 2 },
  { id: "not_picked", label: "Not picked", next: 1 },
  { id: "call_later", label: "Call later", next: null },
  { id: "busy", label: "Busy / switched off", next: 1 },
  { id: "visit_booked", label: "Visit booked", next: 1 },
  { id: "flats_shared", label: "Flats shared", next: 1 },
  { id: "not_interested", label: "Not interested", next: "none" },
  { id: "found_elsewhere", label: "Found elsewhere", next: "none" },
];
export const outcomeLabel = (id) => OUTCOMES.find((o) => o.id === id)?.label ?? id ?? "";
export const endsSearch = (id) => OUTCOMES.find((o) => o.id === id)?.next === "none";

const atHour = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
const plusDays = (now, n) => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };

/** The next date an outcome suggests, or null. */
export function suggestedNext(outcome, now = Date.now()) {
  const n = OUTCOMES.find((o) => o.id === outcome)?.next;
  return typeof n === "number" ? atHour(plusDays(now, n), 10) : null;
}

/** The quick picks: this evening (until 6 pm), tomorrow, in 3 days, next week — at 10 am unless said. */
export function quickPicks(now = Date.now()) {
  const picks = [];
  const evening = atHour(now, 18);
  if (evening.getTime() - now > 30 * 60 * 1000) picks.push({ id: "evening", label: "This evening", at: evening });
  picks.push({ id: "tomorrow", label: "Tomorrow", at: atHour(plusDays(now, 1), 10) });
  picks.push({ id: "3d", label: "In 3 days", at: atHour(plusDays(now, 3), 10) });
  picks.push({ id: "week", label: "Next week", at: atHour(plusDays(now, 7), 10) });
  return picks;
}

/** "Today, 6:00 pm" / "Tomorrow, 10:00 am" / "Thu 6 Nov, 10:00 am". */
export function whenLabel(at, now = Date.now()) {
  if (!at) return "";
  const d = new Date(at);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const day = (x) => atHour(x, 0).getTime();
  const diff = Math.round((day(d) - day(now)) / DAY);
  const date = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday"
    : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return `${date}, ${time}`;
}

/** client_id → when we last reached them (staff contact only), from the shell's touches. */
export function lastContactByClient(touches = []) {
  const m = new Map();
  for (const t of touches) {
    if (!CONTACT_ACTIVITY_TYPES.has(t.type)) continue;
    const at = new Date(t.created_at).getTime();
    if (at > (m.get(t.client_id) ?? 0)) m.set(t.client_id, at);
  }
  return m;
}

export const isActive = (c) => c && !CLOSED.has(c.status) && c.temperature !== "ice";

/**
 * Where a client sits today: 'overdue' | 'today' | 'upcoming' | 'quiet', why,
 * and when. lastSiteAt: their last visit to the site (engagement).
 */
export function followUpState(client, { lastContactAt = 0, lastSiteAt = 0, now = Date.now() } = {}) {
  const lastAny = Math.max(lastContactAt || 0, lastSiteAt || 0, new Date(client.created_at || 0).getTime() || 0,
    new Date(client.follow_up_set_at || 0).getTime() || 0);
  const next = client.next_follow_up_at ? new Date(client.next_follow_up_at).getTime() : 0;
  if (!next && lastAny && now - lastAny > QUIET_DAYS * DAY) {
    return { bucket: "quiet", why: `Nothing for ${Math.floor((now - lastAny) / DAY)} days`, at: lastAny };
  }
  const f = followUp(client, lastContactAt, now);
  if (!f.due) return { bucket: "upcoming", why: f.why, at: next || (lastContactAt + 2 * DAY) };
  return { bucket: f.overdue ? "overdue" : "today", why: f.why, at: next || lastContactAt || 0 };
}

/** Somebody to ring first: on the site in the last day, or moving in within 15 days. */
export function isHotLead({ lastSiteAt = 0, moveInAt = 0, now = Date.now() }) {
  return Boolean((lastSiteAt && now - lastSiteAt < DAY) || (moveInAt && moveInAt - now < 15 * DAY && moveInAt > now - 7 * DAY));
}

/* ── Partners ──────────────────────────────────────────────────────────────── */

export const SLA = {
  red: { label: "No action 48h+", tone: "coral" },
  missed: { label: "Missed follow-up", tone: "coral" },
  amber: { label: "No action 24h+", tone: "gold" },
  new: { label: "New", tone: "mute" },
  ok: { label: "On track", tone: "accent" },
};

/** Where a client sits on the partner's Today list: 'overdue' | 'today' | 'later'. */
export function partnerBucket(row, now = Date.now()) {
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const last = row.last_action_at ? new Date(row.last_action_at).getTime() : 0;
  const assigned = new Date(row.assigned_at).getTime();
  if (row.follow_up_on) {
    if (row.follow_up_on < today) return "overdue";
    if (row.follow_up_on === today) return "today";
    return "later";
  }
  if (!last) return now - assigned > 2 * DAY ? "overdue" : "today";
  return now - last > 2 * DAY ? "today" : "later";
}

const digits10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);

/** The WhatsApp to a partner just given a client. */
export function partnerAssignMessage({ partner, client, need = "", note = "" }) {
  return [
    `Hi ${partner || "there"}, a new MovEazy client for you:`,
    `${client?.name || "Tenant"} – ${digits10(client?.phone)}`,
    need ? `Looking for: ${need}` : "",
    note ? `Note: ${note}` : "",
    "Please call them today and log each call in the MovEazy partner app (Leads → Today).",
  ].filter(Boolean).join("\n");
}

/** Of a partner's open clients (crm_partner_follow_ups rows), the ones to call today. */
export function partnerDueRows(rows = [], now = Date.now()) {
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return rows.filter((r) => r.sla !== "ok" || (r.follow_up_on && r.follow_up_on <= today)
    || (!r.follow_up_on && r.last_action_at && now - new Date(r.last_action_at).getTime() > 2 * DAY));
}

/** A partner's morning list (partnerDueRows) as one WhatsApp. */
export function partnerSummaryMessage(partner, due = []) {
  const lines = due.slice(0, 25).map((r, i) => `${i + 1}. ${r.client_name} – ${digits10(r.client_phone)}${r.sla === "red" ? " (not called yet)" : r.sla === "missed" ? " (follow-up missed)" : ""}`);
  return [
    `Good morning ${partner?.name || ""}! Your MovEazy clients to follow up today: ${due.length}`,
    ...lines,
    due.length > 25 ? `…and ${due.length - 25} more in the app.` : "",
    "Please log each call in the MovEazy partner app (Leads → Today).",
  ].filter(Boolean).join("\n");
}

/* ── Calls ─────────────────────────────────────────────────────────────────── */

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** { outcome?, next_at? (Date | ISO | '' to clear), note?, owner? } → the client row. */
export const saveFollowUp = (clientId, p) => rpc("crm_follow_up_save", {
  p_client: clientId,
  p: { ...p, ...(p.next_at instanceof Date ? { next_at: p.next_at.toISOString() } : {}) },
});

let settingsCache = null;
export async function fetchFollowUpSettings({ fresh = false } = {}) {
  if (!settingsCache || fresh) settingsCache = rpc("crm_follow_up_settings_get").catch((e) => { settingsCache = null; throw e; });
  return settingsCache;
}
export async function setRoundRobin(on) {
  settingsCache = null;
  return rpc("crm_follow_up_settings_set", { p_round_robin: Boolean(on) });
}

export const fetchPartnerPicker = () => rpc("crm_partner_picker").then((r) => r ?? []);
export const assignPartners = (clientId, brokerIds, { replace = false, note = "" } = {}) =>
  rpc("crm_partner_assign", { p_client: clientId, p_brokers: brokerIds, p_replace: replace, p_note: note });
export const unassignPartner = (assignmentId) => rpc("crm_partner_unassign", { p_assignment: assignmentId });
export const fetchPartnerBoard = () => rpc("crm_partner_follow_ups").then((r) => r ?? { rows: [], partners: [] });
/** Today's 9:30 summary, if cron hasn't sent it yet. Never throws. */
export const pokeDigest = () => rpc("follow_up_digest_poke").catch(() => false);

export const fetchPartnerFollowUps = () => rpc("partner_follow_ups").then((r) => r ?? []);
export const savePartnerFollowUp = (assignmentId, outcome, next = "", note = "") =>
  rpc("partner_follow_up_save", { p_assignment: assignmentId, p_outcome: outcome, p_next: next, p_note: note });
