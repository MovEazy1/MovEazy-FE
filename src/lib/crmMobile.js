/**
 * What the CRM's phone screens read (MovEazy-BE/supabase/crm_mobile.sql), and
 * the rules that sort it: which step of paying each partner is on, who has
 * gone quiet, how far a partner's own lead has got.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { STAGE } from "./partnerTenants";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const fetchMobileSummary = () => rpc("crm_mobile_summary");
export const fetchLikedNoVisit = (days = 30) => rpc("crm_liked_no_visit", { p_days: days }).then((r) => r ?? []);
export const fetchLeadsNotCalled = () => rpc("crm_leads_not_called").then((r) => r ?? { moveazy: [], partners: [] });
export const fetchVisitsToday = () => rpc("crm_visits_today").then((r) => r ?? { moveazy: [], partners: [] });
export const fetchPaymentsFlow = () => rpc("crm_payments_flow").then((r) => r ?? []);
export const fetchPartnerUsage = () => rpc("crm_partner_usage", { p_broker: null }).then((r) => r ?? []);
export const fetchPartnerDetail = (brokerId) => rpc("crm_partner_usage", { p_broker: brokerId });

/** Home and Notifications refresh by themselves this often, besides on open. */
export const REFRESH_MS = 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const ts = (d) => (d ? new Date(d).getTime() : 0);

/* ── Payments ───────────────────────────────────────────────────────────── */

/** The steps of paying for Premium, in order; a partner sits at one. */
export const PREMIUM_STEPS = [
  { id: "never", label: "Never tapped Pay", hint: "Signed up, never opened a plan's payment" },
  { id: "tapped", label: "Tapped Pay, didn't pay", hint: "Opened the UPI payment, sent no UTR" },
  { id: "utr", label: "UTR waiting check", hint: "Paid and sent a UTR — approve or reject" },
  { id: "trial", label: "On trial", hint: "Free trial running" },
  { id: "premium", label: "On Premium", hint: "Paid plan running" },
];

/** The same for the ₹2,000 lead pack. */
export const PACK_STEPS = [
  { id: "never", label: "Never tapped", hint: "Never started buying the lead pack" },
  { id: "tapped", label: "Tapped, didn't pay", hint: "Started buying, payment not completed" },
  { id: "utr", label: "UTR waiting check", hint: "Sent a UTR for the lead pack" },
  { id: "bought", label: "Bought", hint: "Lead pack paid" },
];

/** Days left on a plan, rounded up; 0 when it has run out. */
export function daysLeft(until, now = Date.now()) {
  const ms = ts(until) - now;
  return ms > 0 ? Math.ceil(ms / DAY_MS) : 0;
}

/**
 * Where a partner is with Premium. A UTR waiting is shown first even on a
 * trial (someone has to act on it); a tap counts only if nothing after it was
 * paid or sent.
 */
export function premiumStep(b) {
  const pays = b?.premium ?? [];
  if (pays.some((p) => p.status === "payment_check")) return "utr";
  if (b?.plan_source && b.plan_source !== "trial") return "premium";
  const lastTap = Math.max(0, ...pays.filter((p) => p.status === "started").map((p) => ts(p.created_at)));
  const paidAfter = pays.some((p) => ["paid", "approved"].includes(p.status) && ts(p.created_at) >= lastTap);
  if (lastTap && !paidAfter) return "tapped";
  if (b?.plan_source === "trial") return "trial";
  return "never";
}

/** Where a partner is with the lead pack. */
export function packStep(b) {
  const reqs = b?.lead_pack ?? [];
  if (reqs.some((q) => q.status === "payment_check")) return "utr";
  if (reqs.some((q) => ["needs_approval", "open", "fulfilled"].includes(q.status))) return "bought";
  if (reqs.some((q) => q.status === "awaiting_payment")) return "tapped";
  return "never";
}

/** The latest Pay tap that came to nothing, for "₹4,999 plan · 2d ago". */
export function lastUnpaidTap(b) {
  return (b?.premium ?? []).filter((p) => p.status === "started").sort((x, y) => ts(y.created_at) - ts(x.created_at))[0] ?? null;
}

export function countSteps(rows, stepOf, steps) {
  const c = Object.fromEntries(steps.map((s) => [s.id, 0]));
  for (const r of rows) c[stepOf(r)] = (c[stepOf(r)] || 0) + 1;
  return c;
}

/** What to send a partner stuck at a step. */
export function paymentNudge(b, step, pack = false) {
  const first = String(b?.name || "").trim().split(/\s+/)[0] || "there";
  if (pack) {
    if (step === "tapped") return `Hi ${first}, you started buying the MovEazy lead pack but the payment didn't go through. Need any help completing it?`;
    return `Hi ${first}, want 30 fresh MovEazy tenant leads? The lead pack is in the app under Leads.`;
  }
  if (step === "tapped") return `Hi ${first}, you were about to take MovEazy Premium but the payment didn't go through. Can I help you complete it?`;
  if (step === "trial") return `Hi ${first}, how is your MovEazy Premium trial going? Happy to help you get the most leads out of it.`;
  return `Hi ${first}, welcome to MovEazy Partners! Premium gets you unlimited tenant leads and flats from other partners — shall I tell you more?`;
}

/* ── Partner usage ──────────────────────────────────────────────────────── */

/** On trial or Premium and not seen for this many days (or never). */
export const QUIET_DAYS = 3;

export function goneQuiet(rows, now = Date.now()) {
  return rows
    .filter((p) => p.plan_source && (!p.last_seen || now - ts(p.last_seen) >= QUIET_DAYS * DAY_MS))
    .sort((a, b) => ts(a.last_seen) - ts(b.last_seen));
}

const sameDay = (d, now) => {
  if (!d) return false;
  const f = (x) => new Date(x).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return f(d) === f(now);
};

export function usageSummary(rows, now = Date.now()) {
  return {
    activeToday: rows.filter((p) => sameDay(p.last_seen, now)).length,
    activeWeek: rows.filter((p) => p.last_seen && now - ts(p.last_seen) < 7 * DAY_MS).length,
    secondsToday: rows.reduce((s, p) => s + (Number(p.seconds_today) || 0), 0),
    flatsToday: rows.reduce((s, p) => s + (Number(p.flats_today) || 0), 0),
    onPlan: rows.filter((p) => p.plan_source).length,
  };
}

export const USAGE_SORTS = [
  { id: "seen", label: "Last seen", by: (p) => ts(p.last_seen) },
  { id: "today", label: "Time today", by: (p) => Number(p.seconds_today) || 0 },
  { id: "flats", label: "Flats", by: (p) => Number(p.flats) || 0 },
  { id: "leads", label: "MovEazy leads", by: (p) => Number(p.moveazy_leads) || 0 },
  { id: "joined", label: "Newest", by: (p) => ts(p.created_at) },
];

/** "1h 5m", "12m", "40s", "—". */
export function duration(seconds) {
  const s = Math.round(Number(seconds) || 0);
  if (s <= 0) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** How far a partner's own lead has got (the partner app's stages). */
export function ownLeadStage(l) {
  const st = String(l?.status || "");
  if (st === "done" || st === "closed") return STAGE.done;
  if (st === "lost") return STAGE.lost;
  if (Number(l?.visits) > 0) return STAGE.visit;
  if (Number(l?.likes) > 0) return STAGE.liked;
  if (Number(l?.lists_sent) > 0) return STAGE.list_sent;
  if (l?.last_contacted_at) return STAGE.contacted;
  return STAGE.new;
}

/** A MovEazy lead with a partner: its status, and "not called yet" when that's the truth. */
export function moveazyLeadStage(a) {
  const labels = { assigned: "New", contacted: "Contacted", visit: "Visit fixed", closed: "Closed", not_interested: "Not interested" };
  if (a?.status === "assigned") return Number(a?.reach_count) > 0 ? "Called / WhatsApped" : "Not called yet";
  return labels[a?.status] || String(a?.status || "—");
}

/* ── Notifications ──────────────────────────────────────────────────────── */

export const VIA_LABEL = { website: "Liked on the website", moveazy_list: "Liked on a MovEazy list", partner_list: "Liked on a partner's list" };

export function likedMessage(row) {
  const first = String(row?.name || "").trim().split(/\s+/)[0] || "there";
  const flat = [row?.flat_type, row?.area].filter(Boolean).join(" in ") || "the flat";
  return `Hi ${first}, you liked ${flat} on MovEazy. Shall we fix a visit? Tell us a day and time that suits you.`;
}

export function notCalledMessage(row) {
  const first = String(row?.name || "").trim().split(/\s+/)[0] || "there";
  return `Hi ${first}, this is MovEazy — you were looking for a flat. Can we help you find one? What area and budget are you looking at?`;
}

export function partnerNudgeMessage(row) {
  const first = String(row?.broker_name || "").trim().split(/\s+/)[0] || "there";
  return `Hi ${first}, ${row?.name || "a tenant"} is a MovEazy lead we gave you and hasn't been called yet. Please call them today — they're looking for a flat.`;
}

/** Everything waiting on the team, as one number for the Notifications tab's badge. */
export function waitingTotal(s) {
  const w = s?.waiting ?? {};
  return ["slots_required", "payments_to_check", "lead_requests", "messages"].reduce((n, k) => n + (Number(w[k]) || 0), 0);
}
