/**
 * MovEazy leads for partner brokers (MovEazy-BE/supabase/partner_moveazy_leads.sql).
 *
 * Brokers see totals only, ask for a pack, and work the leads MovEazy assigns.
 * Paying for the 30-lead pack is UPI to MovEazy's ID with the UTR typed back
 * in — until Razorpay is switched on — and a CRM admin checks it.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

async function rpc(name, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export const MOVEAZY_DESK = "918090911024";

export const PACKS = {
  free10: { id: "free10", count: 10, title: "10 leads", sub: "Free · once" },
  paid30: { id: "paid30", count: 30, title: "30 leads", sub: "One payment" },
  premium: { id: "premium", count: 10, title: "Unlimited", sub: "Premium · pay only on closures" },
};

export const ASSIGNED_STATUS = {
  assigned: "New",
  contacted: "Contacted",
  visit: "Visit",
  closed: "Closed",
  not_interested: "Not interested",
};

export const REQUEST_STATUS = {
  awaiting_payment: "Payment not completed",
  payment_check: "Checking your payment",
  needs_approval: "Waiting for MovEazy's OK",
  open: "MovEazy is picking your leads",
  fulfilled: "Leads assigned",
  rejected: "Not approved",
  cancelled: "Cancelled",
};

/* ── Calls ────────────────────────────────────────────────────────────────── */

export const fetchLeadStats = () => rpc("partner_moveazy_lead_stats");
export const fetchMyLeadRequests = () => rpc("partner_my_lead_requests").then((r) => r ?? []);
export const fetchMyAssignedLeads = () => rpc("partner_my_assigned_leads").then((r) => r ?? []);
export const requestLeads = (pack, prefs = {}, utr = "", online = false) =>
  rpc("partner_lead_request", { p_pack: pack, p_prefs: prefs, p_utr: utr, p_online: online });

/** Whether Razorpay is set up (api/lead-pay.js). False on any doubt: the UPI QR always works. */
export async function onlinePaymentReady() {
  try {
    const r = await fetch("/api/lead-pay", { method: "GET" });
    return r.ok && (await r.json())?.online === true;
  } catch {
    return false;
  }
}

/** Start a Razorpay payment for an online 30-lead request. → the URL to send them to, or "" to fall back to UPI. */
export async function startLeadPayment(requestId) {
  if (!isSupabaseConfigured || !supabase) return "";
  const { data: { session } = {} } = await supabase.auth.getSession();
  try {
    const r = await fetch("/api/lead-pay", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token || ""}` },
      body: JSON.stringify({ request: requestId }),
    });
    const body = await r.json().catch(() => ({}));
    return body?.url || "";
  } catch {
    return "";
  }
}
export const logReachOut = (assignmentId, channel) =>
  rpc("partner_lead_reach_out", { p_assignment: assignmentId, p_channel: channel });
export const updateAssignedLead = (assignmentId, status, rent = null, deal = null) =>
  rpc("partner_lead_update", { p_assignment: assignmentId, p_status: status, p_rent: rent, p_deal: deal });

/* CRM (partners.manage) */
export const crmLeadRequests = () => rpc("crm_lead_requests").then((r) => r ?? []);
export const crmDecideLeadRequest = (id, approve, note = "") =>
  rpc("crm_lead_request_decide", { p_request: id, p_approve: approve, p_note: note });
export const crmLeadCandidates = (id) => rpc("crm_lead_candidates", { p_request: id }).then((r) => r ?? []);
export const crmAssignLeads = (id, clientIds) => rpc("crm_lead_assign", { p_request: id, p_clients: clientIds });
export const crmClientBrokers = (clientId) => rpc("crm_client_brokers", { p_client: clientId }).then((r) => r ?? []);
export const crmLeadClosures = () => rpc("crm_lead_closures").then((r) => r ?? []);
export const crmLeadSettings = () => rpc("crm_lead_settings");
export const crmSetLeadSettings = (upi, price) => rpc("crm_set_lead_settings", { p_upi: upi, p_price: Number(price) });

/* ── Pure helpers (partnerLeads.test.js) ──────────────────────────────────── */

/** A UPI payment link — what the QR holds; any UPI app opens it with the amount filled in. */
export function upiLink({ vpa, amount, name = "MovEazy", note = "" }) {
  if (!vpa) return "";
  const q = new URLSearchParams({ pa: vpa, pn: name, cu: "INR" });
  if (amount) q.set("am", String(Math.round(Number(amount))));
  if (note) q.set("tn", note.slice(0, 60));
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
}

/** UTRs are 12 digits on UPI, longer letters-and-digits on bank transfers. */
export function cleanUtr(raw) {
  return String(raw || "").replace(/\s+/g, "").toUpperCase();
}
export const isUtr = (raw) => /^[A-Z0-9]{6,30}$/.test(cleanUtr(raw));

/** "₹20–35k"-style label for a budget band key from the stats. */
export const BUDGET_BANDS = [
  ["under20", "Under ₹20k"],
  ["b20_35", "₹20k – 35k"],
  ["b35_50", "₹35k – 50k"],
  ["b50plus", "₹50k +"],
];

/** The move-in rows to show, in order, from the stats' move_in object. */
export function moveInRows(m = {}) {
  const before = m.before_date
    ? new Date(`${m.before_date}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";
  return [
    ["Moving within a week", m.week ?? 0],
    [before ? `Moving before ${before}` : "Moving this month", m.before ?? 0],
    ["In 8–30 days", m.month ?? 0],
    ["In 1–2 months", m.two_months ?? 0],
    ["Later", m.later ?? 0],
    ["Flexible / not sure", m.flexible ?? 0],
  ];
}

/** The BHK × area sets: the broker's own areas first, then the biggest. */
export function topSets(pairs = [], myAreas = [], limit = 8) {
  const mine = new Set(myAreas.map((a) => a.toLowerCase()));
  return [...pairs]
    .filter((p) => p.n > 0)
    .sort((a, b) => (mine.has(b.area.toLowerCase()) - mine.has(a.area.toLowerCase())) || b.n - a.n)
    .slice(0, limit);
}

/** MovEazy's share on a Premium closure: 30% of a month's rent direct with the owner, 20% with other brokers. */
export function closureDue(rent, deal, pack = "premium") {
  if (pack !== "premium") return 0;
  const r = Number(rent) || 0;
  return Math.round(r * (deal === "direct" ? 0.3 : 0.2));
}

/** What a broker over the 20-leads-a-closure line sends MovEazy. */
export function moreLeadsMessage(name = "", given = 0, closed = 0) {
  return `Hi MovEazy, ${name ? `${name} here — ` : ""}I'd like more MovEazy leads. `
    + `I've had ${given} so far and closed ${closed}. Please approve my next set.`;
}

/** Their requirement, as one line. */
export function leadNeedLine(l) {
  const budget = l.budget_max ? `up to ₹${Number(l.budget_max).toLocaleString("en-IN")}`
    : l.budget_min ? `from ₹${Number(l.budget_min).toLocaleString("en-IN")}` : "";
  const moveIn = l.move_in
    ? `move-in ${new Date(`${l.move_in}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : l.move_in_raw ? `move-in: ${l.move_in_raw}` : "";
  return [(l.flat_types ?? []).join("/"), (l.localities ?? []).slice(0, 3).join(", "), budget, moveIn].filter(Boolean).join(" · ");
}

/** The badge on the MovEazy leads tab: NEW until it's first opened, then the leads not yet contacted. */
export function moveazyTabBadge(seen, assigned = []) {
  if (!seen) return "NEW";
  const n = assigned.filter((a) => a.status === "assigned").length;
  return n > 99 ? "99+" : n ? String(n) : "";
}

/** Whether a broker has asked for MovEazy leads yet (an online payment never finished doesn't count). */
export const hasAskedForLeads = (requests = []) =>
  requests.some((r) => !["cancelled", "awaiting_payment"].includes(r.status));

/** "Unable to pay?" on a UPI QR: the WhatsApp to MovEazy, pre-filled. */
export function unablePayMessage(what, name = "", phone = "") {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  const mobile = digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : "";
  return `Hi MovEazy, I'm unable to pay for ${what} on the partner app.`
    + [name && ` Name: ${name}`, mobile && ` Mobile: ${mobile}`].filter(Boolean).join(" ·") + (name || mobile ? "." : "");
}
