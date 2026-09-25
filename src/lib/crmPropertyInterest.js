/**
 * What a client wants, read from the flats they opened.
 *
 * A client who never finishes Find My Flat shows up in the CRM as "not set"
 * everywhere — area, budget, flat type — even when they arrived on a shared
 * link to a 2 BHK in JP Nagar at ₹27k and so have answered all three. This
 * turns that evidence into a stand-in requirement.
 *
 * Deliberately never saved. It is recomputed from the evidence on every load
 * and only fills fields that are otherwise empty, so it is temporary by
 * construction: the moment the client answers for themselves, or an agent
 * types a requirement, those win and this is no longer consulted. It also
 * means every existing client gets it without a backfill.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * How much each kind of evidence says about what they want.
 *
 * A booked visit is the strongest statement, a like the next. The flat whose
 * link brought them in is their first choice. A flat the team chose and they merely opened says
 * more about us than about them. Dislikes never arrive here — the query
 * excludes them, because a rejected flat is evidence against its area.
 */
export const SIGNAL_WEIGHT = {
  // Above a like: asking to see a flat costs them an afternoon.
  booked: 4,
  liked: 3,
  opened_link: 2,
  okay: 1,
  opened_share: 1,
};

export const SIGNAL_LABEL = {
  booked: "booked a visit",
  liked: "liked",
  opened_link: "opened",
  okay: "marked okay",
  opened_share: "opened",
};

/** Every client's evidence, in one request. [] until the SQL has been run. */
export async function fetchPropertyInterest() {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase.rpc("crm_client_property_interest");
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export function groupInterestByClient(rows = []) {
  const m = new Map();
  for (const r of rows) {
    if (!r?.client_id || !r?.property_id) continue;
    if (!m.has(r.client_id)) m.set(r.client_id, []);
    m.get(r.client_id).push(r);
  }
  return m;
}

const roundDown = (n) => Math.floor(n / 1000) * 1000;
const roundUp = (n) => Math.ceil(n / 1000) * 1000;
const ts = (iso) => {
  const t = new Date(iso ?? 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Distinct values ranked by the total weight behind them, most recent breaking ties. */
function ranked(evidence, pick, limit) {
  const score = new Map();
  for (const e of evidence) {
    const v = String(pick(e.listing) ?? "").trim();
    if (!v) continue;
    const cur = score.get(v) ?? { v, w: 0, at: 0 };
    cur.w += e.weight;
    cur.at = Math.max(cur.at, e.at);
    score.set(v, cur);
  }
  return [...score.values()]
    .sort((a, b) => b.w - a.w || b.at - a.at)
    .slice(0, limit)
    .map((x) => x.v);
}

/**
 * A stand-in requirement from one client's evidence, or null if there is none
 * to read.
 *
 * `inventoryById` is a Map of property_id → listing. A flat that is no longer
 * in inventory is skipped rather than guessed at.
 */
export function inferRequirement(signals = [], inventoryById = new Map()) {
  // One entry per flat, carrying its strongest signal. A flat they liked and
  // then booked is one piece of evidence, not two — otherwise a single flat
  // can outvote three others.
  const byProperty = new Map();
  for (const s of signals) {
    const listing = inventoryById.get(s.property_id);
    if (!listing) continue;
    const weight = SIGNAL_WEIGHT[s.signal] ?? 0;
    if (weight <= 0) continue;
    const cur = byProperty.get(s.property_id);
    const at = ts(s.at);
    if (!cur || weight > cur.weight || (weight === cur.weight && at > cur.at)) {
      byProperty.set(s.property_id, { listing, weight, signal: s.signal, at, propertyId: s.property_id });
    }
  }
  const all = [...byProperty.values()];
  if (!all.length) return null;

  // If they have told us anything themselves, that is the evidence. Flats we
  // chose and they only clicked are used only when there is nothing better.
  const strong = all.filter((e) => e.weight >= 2);
  const evidence = strong.length ? strong : all;

  const rents = evidence.map((e) => Number(e.listing.rent) || 0).filter((r) => r > 0);
  const minRent = rents.length ? Math.min(...rents) : 0;
  const maxRent = rents.length ? Math.max(...rents) : 0;

  const basis = [...evidence]
    .sort((a, b) => b.weight - a.weight || b.at - a.at)
    .map((e) => ({ propertyId: e.propertyId, signal: e.signal }));

  return {
    localities: ranked(evidence, (l) => l.area, 3),
    flat_types: ranked(evidence, (l) => l.flat_type, 2),
    // A little either side of what they looked at: someone who opened a ₹27k
    // flat will look at ₹25k and ₹29k, and matching on the exact figure would
    // find nothing.
    budget_min: minRent ? roundDown(minRent * 0.9) : null,
    budget_max: maxRent ? roundUp(maxRent * 1.1) : null,
    // What was actually seen, for display — the padded range above is for
    // matching, and showing it would claim a range nobody stated.
    rentSeen: rents.length ? { min: minRent, max: maxRent } : null,
    basis,
  };
}

/** Has anyone told us anything real about what this client wants? */
export function hasStatedRequirement(req) {
  if (!req) return false;
  return Boolean(
    (req.localities ?? []).length || (req.flat_types ?? []).length ||
    (req.must_haves ?? []).length || (req.deal_breakers ?? []).length ||
    (req.occupants ?? []).length || req.furnishing || req.move_in ||
    req.budget_min || req.budget_max,
  );
}

const hasList = (v) => Array.isArray(v) && v.length > 0;

/**
 * Area, budget and flat type, each from the best source that has it.
 *
 * Per field, in order: what the agent recorded, what the client answered in
 * the wizard, then what the flats they opened imply. Per field rather than all
 * or nothing, because the usual gap is partial — somebody who picked an area
 * and quit before the budget question has still shown us a budget.
 */
export function effectiveFacts(req, ownAnswers, inferred) {
  const pickList = (key) => {
    if (hasList(req?.[key])) return { value: req[key], inferred: false };
    if (hasList(ownAnswers?.[key])) return { value: ownAnswers[key], inferred: false };
    if (hasList(inferred?.[key])) return { value: inferred[key], inferred: true };
    return { value: [], inferred: false };
  };
  const pickBudget = () => {
    if (req?.budget_min || req?.budget_max) {
      return { min: req.budget_min, max: req.budget_max, inferred: false };
    }
    if (ownAnswers?.budget_min || ownAnswers?.budget_max) {
      return { min: ownAnswers.budget_min, max: ownAnswers.budget_max, inferred: false };
    }
    if (inferred?.rentSeen) {
      return { min: inferred.rentSeen.min, max: inferred.rentSeen.max, inferred: true };
    }
    return { min: null, max: null, inferred: false };
  };
  return {
    localities: pickList("localities"),
    flat_types: pickList("flat_types"),
    budget: pickBudget(),
  };
}

/**
 * The requirement matching should run on.
 *
 * The client's own if there is one. Otherwise their existing (empty) record
 * with the inferred fields laid in, so the settings on it — the minimum score,
 * for one — are kept.
 */
export function requirementForMatching(req, inferred) {
  if (hasStatedRequirement(req) || !inferred) return req;
  return {
    ...req,
    localities: inferred.localities,
    flat_types: inferred.flat_types,
    budget_min: inferred.budget_min,
    budget_max: inferred.budget_max,
  };
}

/** "₹27k", or "₹22k–₹30k" when they looked across a range. */
export function rentSeenLabel(rentSeen) {
  if (!rentSeen) return "";
  const k = (n) => `₹${Math.round(n / 1000)}k`;
  return rentSeen.min === rentSeen.max ? k(rentSeen.max) : `${k(rentSeen.min)}–${k(rentSeen.max)}`;
}

/** "MZ-RPN52S" or "MZ-RPN52S +2" — which flats the guess rests on. */
export function basisLabel(inferred) {
  const ids = (inferred?.basis ?? []).map((b) => b.propertyId);
  if (!ids.length) return "";
  return ids.length === 1 ? ids[0] : `${ids[0]} +${ids.length - 1}`;
}
