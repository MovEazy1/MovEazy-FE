/**
 * Read-only aggregation behind the admin panel.
 *
 * Every fetch is defensive: a table that hasn't been created yet, or one the
 * caller isn't allowed to read, resolves to an empty list rather than throwing,
 * so one missing migration can't blank the whole panel.
 *
 * IMPORTANT: seeing *other* users' rows depends on Postgres, not on the UI —
 * public.is_admin_allowlisted() must return true, i.e. the signed-in email has
 * to exist in public.admin_allowlist. Without that the RLS policies fall back to
 * "own rows only" and these queries come back nearly empty.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

async function safeSelect(table, columns = "*", shape = (q) => q) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await shape(supabase.from(table).select(columns));
    if (error) {
      console.warn(`[admin] ${table}: ${error.message}`);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn(`[admin] ${table} threw: ${e?.message}`);
    return [];
  }
}

/* ── raw sources ──────────────────────────────────────────────────────────── */
export const fetchProfiles = () =>
  safeSelect("user_profiles", "id,email,name,phone,role,seller_badge_status,created_at", (q) =>
    q.order("created_at", { ascending: false }).limit(2000));

export const fetchSearchProfiles = () =>
  safeSelect("customer_search_profiles",
    "user_id,preferred_areas,budget_min,budget_max,bhk,move_in_date,commute_to,updated_at");

export const fetchRequirements = () =>
  safeSelect("user_requirements",
    "user_id,email,localities,budget_min,budget_max,flat_types,occupants,whatsapp,last_match_count,created_at,updated_at");

export const fetchBookings = () =>
  safeSelect("visit_bookings", "id,user_id,property_id,slot_at,kind,status,created_at", (q) =>
    q.order("created_at", { ascending: false }).limit(4000));

export const fetchActions = () =>
  safeSelect("user_actions", "id,user_id,email,action,property_id,created_at", (q) =>
    q.order("created_at", { ascending: false }).limit(6000));

export const fetchInventoryAll = () =>
  safeSelect("inventory",
    "property_id,posted_by,poster_id,poster_name,poster_email,phone,city,area,rent,deposit,flat_type,status,is_verified,view_count,title,images,created_at",
    (q) => q.order("created_at", { ascending: false }).limit(2000));

/* ── bucketing ────────────────────────────────────────────────────────────── */

/** A move-in value can be a date or free text ("ASAP", "Next month"). Sort real
 *  dates first (soonest first), then text, then people who never told us. */
export function moveInRank(raw) {
  const v = String(raw || "").trim();
  if (!v) return { ts: Number.POSITIVE_INFINITY, label: "—", known: false };
  const t = Date.parse(v);
  if (!Number.isNaN(t)) {
    return { ts: t, known: true, label: new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) };
  }
  // Free text still tells us something — keep it, just after the real dates.
  return { ts: Number.MAX_SAFE_INTEGER - 1, known: true, label: v };
}

export const BUCKETS = [
  { id: "visits",       label: "Visits scheduled",  hint: "Booked at least one property visit" },
  { id: "shortlisted",  label: "Flats shortlisted",  hint: "Saved or liked a home, no visit booked yet" },
  { id: "interacted",   label: "Interacted",         hint: "Clicked through the product but hasn't shortlisted" },
  { id: "requirements", label: "Told us what they want", hint: "Finished Find My Flat, no activity since" },
  { id: "dormant",      label: "Dormant",            hint: "Signed up and stopped" },
];

const SHORTLIST_ACTIONS = /shortlist|save|like|favourite|favorite/i;

/**
 * One row per signed-up person, with their most engaged bucket. Buckets are
 * ordered by intent — someone who booked a visit is counted there even though
 * they also shortlisted, so each person appears exactly once.
 */
export function buildClientLeads({ profiles, searchProfiles, requirements, bookings, actions }) {
  const byUser = (list, key = "user_id") => {
    const m = new Map();
    for (const r of list) {
      const k = r[key];
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  };
  const sp = new Map(searchProfiles.map((r) => [r.user_id, r]));
  const rq = new Map(requirements.map((r) => [r.user_id, r]));
  const bk = byUser(bookings);
  const ac = byUser(actions);

  // Someone may have acted before a profile row existed — keep them visible.
  const ids = new Set([
    ...profiles.map((p) => p.id),
    ...searchProfiles.map((r) => r.user_id),
    ...requirements.map((r) => r.user_id),
    ...bookings.map((r) => r.user_id),
    ...actions.map((r) => r.user_id),
  ].filter(Boolean));

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return [...ids].map((id) => {
    const p = profileById.get(id) || {};
    const s = sp.get(id) || {};
    const r = rq.get(id) || {};
    const myBookings = bk.get(id) || [];
    const myActions = ac.get(id) || [];
    const shortlists = myActions.filter((a) => SHORTLIST_ACTIONS.test(a.action || ""));

    const bucket =
      myBookings.length ? "visits"
      : shortlists.length ? "shortlisted"
      : myActions.length ? "interacted"
      : (r.user_id || s.user_id) ? "requirements"
      : "dormant";

    const areas = [...new Set([...(s.preferred_areas || []), ...(r.localities || [])])];
    const moveIn = moveInRank(s.move_in_date);

    return {
      id,
      email: p.email || r.email || myActions[0]?.email || "—",
      name: p.name || "",
      phone: p.phone || r.whatsapp || "",
      role: p.role || "customer",
      signedUpAt: p.created_at || null,
      bucket,
      areas,
      budgetMin: s.budget_min ?? r.budget_min ?? null,
      budgetMax: s.budget_max ?? r.budget_max ?? null,
      bhk: s.bhk || (r.flat_types || []).join(", ") || "",
      moveInLabel: moveIn.label,
      moveInTs: moveIn.ts,
      visits: myBookings.length,
      shortlists: shortlists.length,
      interactions: myActions.length,
      lastActivity: myActions[0]?.created_at || myBookings[0]?.created_at || p.created_at || null,
      matchCount: r.last_match_count ?? null,
    };
  });
}

/** Supply-side leads, grouped by who brought the flat in. */
export const FLAT_SOURCES = [
  { id: "owner",  label: "Owners" },
  { id: "tenant", label: "Tenants passing on" },
  { id: "broker", label: "Brokers" },
];

export function buildFlatLeads(inventory) {
  return inventory.map((r) => ({
    ...r,
    source: FLAT_SOURCES.some((s) => s.id === r.posted_by) ? r.posted_by : "owner",
    closed: r.status === "rented" || r.status === "sold",
  }));
}

/** Posters grouped into one row each, so an owner with 3 flats appears once. */
export function buildPosters(inventory, profiles, kind) {
  const wanted = kind === "broker" ? ["broker"] : ["owner", "tenant"];
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const m = new Map();
  for (const r of inventory) {
    if (!wanted.includes(r.posted_by)) continue;
    const key = r.poster_id || r.poster_email || r.property_id;
    if (!m.has(key)) {
      const p = profileById.get(r.poster_id) || {};
      m.set(key, {
        key,
        name: r.poster_name || p.name || "",
        email: r.poster_email || p.email || "—",
        phone: r.phone || p.phone || "",
        role: p.role || r.posted_by,
        listings: [],
        joinedAt: p.created_at || null,
      });
    }
    m.get(key).listings.push(r);
  }
  return [...m.values()].map((o) => {
    const live = o.listings.filter((l) => l.status === "published").length;
    const closed = o.listings.filter((l) => l.status === "rented" || l.status === "sold").length;
    const lastAt = o.listings.reduce((a, l) => (l.created_at > a ? l.created_at : a), "");
    return {
      ...o,
      total: o.listings.length,
      live,
      closed,
      views: o.listings.reduce((n, l) => n + (l.view_count || 0), 0),
      areas: [...new Set(o.listings.map((l) => l.area).filter(Boolean))],
      lastListedAt: lastAt || null,
      // "Active" = still has something live on the platform.
      active: live > 0,
    };
  });
}

/** Brokers who signed up but never listed still matter — merge them in. */
export function buildBrokers(inventory, profiles) {
  const fromListings = buildPosters(inventory, profiles, "broker");
  const seen = new Set(fromListings.map((b) => b.email.toLowerCase()));
  const signedUpOnly = profiles
    .filter((p) => p.role === "broker" && !seen.has(String(p.email).toLowerCase()))
    .map((p) => ({
      key: p.id, name: p.name || "", email: p.email, phone: p.phone || "", role: "broker",
      listings: [], total: 0, live: 0, closed: 0, views: 0, areas: [],
      joinedAt: p.created_at || null, lastListedAt: null, active: false,
    }));
  return [...fromListings, ...signedUpOnly];
}
