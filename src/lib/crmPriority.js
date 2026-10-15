/**
 * CRM → Priority closures: the clients the team works hardest, sorted into
 * pools by flat type and brackets by budget, beside the flats in the same
 * pool and bracket (MovEazy-BE/supabase/crm_priority.sql holds who is in).
 *
 *   pools     1, 2, 3 BHK split into rent brackets; 4 BHK is one bucket. A
 *             client is in a pool for every flat type they want.
 *   brackets  a flat is in by its rent, a client by their max budget, each
 *             with ±2k either side — so 21k shows in "< 20k" and "20–25k".
 *   daily     who is due a follow-up (their date, or 2 days since we last
 *             reached them), flats new since their last list, this morning's
 *             fresh picks, who is hot, who has gone silent, today's scorecard.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { scoreMatch } from "./inventoryMatch";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export async function fetchPriority() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.from("crm_priority_clients").select("client_id,active_from,added_by,added_at");
  if (error) { console.warn(`[crm] priority: ${error.message}`); return []; }
  return data ?? [];
}
/** Add clients now, or from a day (they show from that day). */
export const addToPriority = (clientIds, from = null) =>
  rpc("crm_priority_add", { p_clients: clientIds, p_from: from ? new Date(from).toISOString() : null });
/** Remove now, or until a day (they come back that day). */
export const removeFromPriority = (clientId, backOn = null) =>
  rpc("crm_priority_remove", { p_client: clientId, p_back_on: backOn ? new Date(backOn).toISOString() : null });

export async function setFollowUp(clientId, at) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.from("crm_clients")
    .update({ next_follow_up_at: at ? new Date(at).toISOString() : null }).eq("id", clientId).select().single();
  if (error) throw error;
  return data;
}

/* ── Pools and brackets ─────────────────────────────────────────────────── */

const K = 1000;
const b = (lo, hi, label) => ({ id: `${lo}-${hi}`, lo, hi, label });
export const POOLS = [
  { id: "1", label: "1 BHK", brackets: [b(0, 20 * K, "< 20k"), b(20 * K, 25 * K, "20–25k"), b(25 * K, 30 * K, "25–30k"), b(30 * K, Infinity, "> 30k")] },
  { id: "2", label: "2 BHK", brackets: [b(0, 35 * K, "< 35k"), b(35 * K, 40 * K, "35–40k"), b(40 * K, 45 * K, "40–45k"), b(45 * K, 50 * K, "45–50k"),
    b(50 * K, 55 * K, "50–55k"), b(55 * K, 60 * K, "55–60k"), b(60 * K, Infinity, "> 60k")] },
  { id: "3", label: "3 BHK", brackets: [b(0, 50 * K, "< 50k"), b(50 * K, 60 * K, "50–60k"), b(60 * K, 70 * K, "60–70k"), b(70 * K, 80 * K, "70–80k"),
    b(80 * K, 90 * K, "80–90k"), b(90 * K, Infinity, "> 90k")] },
  { id: "4", label: "4 BHK", brackets: [b(0, Infinity, "All 4 BHK")] },
];
/** Either side of a bracket, for flats and clients alike. */
export const SLACK = 2 * K;
/** The clients' bracket when they gave no budget. */
export const NO_BUDGET = "none";

/** "2 BHK" → "2", "4+ BHK"/"5 BHK" → "4", "1 RK"/"Villa" → null. */
export function poolOf(text) {
  const m = /(\d+)\s*\+?\s*bhk/i.exec(String(text || ""));
  if (!m) return null;
  return String(Math.min(4, Math.max(1, Number(m[1]))));
}
export function flatPool(l) {
  return poolOf(l?.flat_type) || (Number(l?.bedrooms) > 0 ? String(Math.min(4, Number(l.bedrooms))) : null);
}
export const inBracket = (value, br) => {
  const v = Number(value);
  return Number.isFinite(v) && v > 0 && v >= br.lo - SLACK && v <= br.hi + SLACK;
};
/** Which brackets of a pool a value sits in (one, or two near an edge). */
export const bracketsFor = (pool, value) => (POOLS.find((p) => p.id === pool)?.brackets ?? []).filter((br) => inBracket(value, br)).map((br) => br.id);

/**
 * One priority client, placed. `facts` is effectiveFacts() — the agent's
 * requirement, else the client's own answers, else what they browsed.
 * → { pools: ["1","2"], max, brackets: { "1": ["25000-30000"], "2": [...] } }
 */
export function placeClient(facts) {
  const types = facts?.flat_types?.value ?? [];
  const pools = [...new Set(types.map(poolOf).filter(Boolean))].sort();
  const max = Number(facts?.budget?.max) || Number(facts?.budget?.min) || null;
  const brackets = Object.fromEntries(pools.map((p) => [p, max ? bracketsFor(p, max) : [NO_BUDGET]]));
  return { pools, max, brackets };
}

/** Is the client in this pool and any of these brackets? */
export const clientIn = (placed, pool, ids) =>
  placed.pools.includes(pool) && (placed.brackets[pool] ?? []).some((id) => ids.has(id));
/** Is the flat (live) in this pool and any of these brackets? */
export function flatIn(l, pool, ids) {
  if (flatPool(l) !== pool) return false;
  const brs = POOLS.find((p) => p.id === pool)?.brackets ?? [];
  return brs.some((br) => ids.has(br.id) && inBracket(l.rent, br));
}

/* ── Follow-ups ─────────────────────────────────────────────────────────── */

export const DAY = 24 * 60 * 60 * 1000;
/** Every priority client hears from us at least this often. */
export const CONTACT_EVERY_DAYS = 2;
const ts = (d) => (d ? new Date(d).getTime() : 0);
const endOfToday = (now) => { const d = new Date(now); d.setHours(23, 59, 59, 999); return d.getTime(); };

/**
 * Due today? Their follow-up date if one is set; otherwise 2 days since we
 * last reached them (or never). → { due, overdue, why }
 */
export function followUp(client, lastContactAt, now = Date.now()) {
  const next = ts(client?.next_follow_up_at);
  if (next) {
    if (next > endOfToday(now)) return { due: false, overdue: false, why: `Follow up ${new Date(next).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` };
    return { due: true, overdue: next < now - DAY / 2, why: next < now ? "Follow-up date passed" : "Follow up today" };
  }
  if (!lastContactAt) return { due: true, overdue: true, why: "Never contacted" };
  const days = Math.floor((now - lastContactAt) / DAY);
  if (days >= CONTACT_EVERY_DAYS) return { due: true, overdue: days > CONTACT_EVERY_DAYS, why: `Last contact ${days}d ago` };
  return { due: false, overdue: false, why: `Contacted ${days === 0 ? "today" : `${days}d ago`}` };
}

/* ── Flats for a client ─────────────────────────────────────────────────── */

/** Flats already sent to this client (any list), and when the last went. */
export function sentTo(clientId, shortlists = []) {
  const ids = new Set();
  let last = 0;
  for (const s of shortlists) {
    if (s.client_id !== clientId || !s.shared_at) continue;
    ids.add(s.property_id);
    last = Math.max(last, ts(s.shared_at));
  }
  return { ids, last };
}

/** Is this live flat a fit: one of their pools, within their budget bracket (±2k), and a fair score. */
export function fitsClient(l, placed, req) {
  if (l?.status !== "published") return false;
  const pool = flatPool(l);
  if (!pool || !placed.pools.includes(pool)) return false;
  const ids = new Set(placed.brackets[pool] ?? []);
  if (!ids.has(NO_BUDGET) && !flatIn(l, pool, ids)) return false;
  return !(req?.localities ?? []).length || scoreMatch(l, req).score >= 40;
}

/**
 * Fits they haven't been sent, newest first — those added since their last
 * list are the "new" ones (or the last 7 days, if nothing has gone yet).
 */
export function freshFor({ inventory, placed, req, sent, passed = new Set(), now = Date.now() }) {
  const since = sent.last || now - 7 * DAY;
  return inventory
    .filter((l) => !sent.ids.has(l.property_id) && !passed.has(l.property_id) && ts(l.created_at) > since && fitsClient(l, placed, req))
    .sort((a, b2) => ts(b2.created_at) - ts(a.created_at));
}

/** This morning's picks: fits added in the last day, best match first, up to 5. */
export const MORNING_PICKS = 5;
export function morningPicks({ inventory, placed, req, sent, passed = new Set(), now = Date.now() }) {
  return inventory
    .filter((l) => !sent.ids.has(l.property_id) && !passed.has(l.property_id) && ts(l.created_at) > now - DAY && fitsClient(l, placed, req))
    .map((l) => ({ l, s: req ? scoreMatch(l, req).score : 0 }))
    .sort((a, b2) => b2.s - a.s || ts(b2.l.created_at) - ts(a.l.created_at))
    .slice(0, MORNING_PICKS)
    .map((x) => x.l);
}

/* ── Signals ────────────────────────────────────────────────────────────── */

/** Within this, a client's own move makes them hot. */
export const HOT_HOURS = 72;
/** We reached out, they've done nothing for this long: silent. */
export const SILENT_DAYS = 7;

/**
 * Their latest move: a like, an opened list, a visit asked for, time on the
 * site (activities with no staff email). → { at, label } | null
 */
export function lastSignal(clientId, { shortlists = [], touches = [] }) {
  let best = null;
  const take = (at, label) => { if (at && (!best || at > best.at)) best = { at, label }; };
  for (const s of shortlists) {
    if (s.client_id !== clientId) continue;
    if (s.status === "liked") take(ts(s.reacted_at), "Liked a flat");
    else if (s.status === "visit_scheduled") take(ts(s.reacted_at), "Asked for a visit");
    take(ts(s.last_opened_at || s.opened_at), "Opened a list");
  }
  for (const a of touches) {
    if (a.client_id !== clientId || String(a.actor_email || "").trim()) continue;
    take(ts(a.created_at), a.type === "visit" ? "Asked for a visit" : "Active on the site");
  }
  return best;
}

export const isHot = (signal, now = Date.now()) => Boolean(signal && now - signal.at < HOT_HOURS * 3600 * 1000);
export const isSilent = (signal, lastContactAt, now = Date.now()) =>
  Boolean(lastContactAt) && now - Math.max(lastContactAt, signal?.at || 0) >= SILENT_DAYS * DAY && (!signal || signal.at < lastContactAt);

/* ── Today's scorecard ──────────────────────────────────────────────────── */

const sameDay = (t, now) => t && new Date(t).toDateString() === new Date(now).toDateString();
const CONTACT = new Set(["whatsapp", "call", "contacted", "status"]);

/** Per agent today: clients contacted, lists sent; and the team's closures. */
export function scorecard({ touches = [], shortlists = [], clients = [], priorityIds = new Set(), now = Date.now() }) {
  const by = new Map();
  const row = (who) => {
    if (!by.has(who)) by.set(who, { who, contacted: new Set(), priority: new Set(), lists: new Set() });
    return by.get(who);
  };
  for (const a of touches) {
    const who = String(a.actor_email || "").trim();
    if (!who || !CONTACT.has(a.type) || !sameDay(a.created_at, now)) continue;
    row(who).contacted.add(a.client_id);
    if (priorityIds.has(a.client_id)) row(who).priority.add(a.client_id);
  }
  for (const s of shortlists) {
    if (!s.shared_at || !sameDay(s.shared_at, now) || !s.shared_by) continue;
    row(s.shared_by).lists.add(s.client_id);
  }
  const agents = [...by.values()].map((r) => ({ who: r.who, contacted: r.contacted.size, priority: r.priority.size, lists: r.lists.size }))
    .sort((a, b2) => b2.contacted + b2.lists - (a.contacted + a.lists));
  const closures = clients.filter((c) => c.status === "closed_by_us" && sameDay(c.closed_at, now)).length;
  return { agents, closures };
}

/* ── Suggestions ────────────────────────────────────────────────────────── */

const CLOSED = new Set(["closed_by_us", "closed_outside"]);

/**
 * Worth a place in Priority: not in yet, not closed, a number, and hot by
 * temperature, a move in the last 7 days, or moving in within 30 days.
 */
export function suggestions({ clients, priorityIds, signalOf, moveInOf, now = Date.now(), limit = 30 }) {
  return clients
    .filter((c) => !priorityIds.has(c.id) && !CLOSED.has(c.status) && String(c.phone || "").replace(/\D/g, "").length >= 10)
    .map((c) => {
      const sig = signalOf(c.id);
      const moveIn = moveInOf(c);
      const why = [];
      let rank = 0;
      // On fire first, then a recent move of their own (the newer the higher), hot, then moving soon.
      if (c.temperature === "fire") { why.push("On fire"); rank += 30; }
      if (c.temperature === "hot") { why.push("Hot"); rank += 15; }
      if (sig && now - sig.at < 7 * DAY) { why.push(sig.label); rank += 20 + (1 - (now - sig.at) / (7 * DAY)) * 5; }
      if (moveIn && moveIn - now < 30 * DAY && moveIn > now - 7 * DAY) { why.push("Moving in within 30 days"); rank += 10; }
      return { c, why, rank };
    })
    .filter((x) => x.why.length)
    .sort((a, b2) => b2.rank - a.rank)
    .slice(0, limit);
}
