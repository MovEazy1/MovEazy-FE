/**
 * The broker directory, and what each broker has actually brought us.
 *
 * Staff only, like the rest of the internal property details: crm_brokers and
 * inventory_private have no anon grant and every row is behind is_crm_staff()
 * (MovEazy-BE/supabase/crm_property_internal.sql). Imported only by CRM pages.
 *
 * The numbers are derived, never stored: a flat, a visit or a closed deal is
 * credited to a broker by following it back to the flat, so they can't drift
 * from the data they describe.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { normalizeIndianMobile } from "./mobile";

/** Every flat credited to a broker in its internal details. */
export async function fetchBrokerLinks() {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("inventory_private")
      .select("property_id,broker_id,created_at")
      .not("broker_id", "is", null)
      .limit(10000);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Every visit ever booked — property and status only.
 *
 * All time rather than the Visits tab's last month: a broker's count is
 * everything their flats have drawn, and a month's window would shrink it
 * every day nothing new is booked.
 */
export async function fetchAllVisitBookings() {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("visit_bookings")
      .select("property_id,status")
      .limit(20000);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

const ts = (v) => {
  const t = new Date(v ?? 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Revenue that has actually arrived, as opposed to what a closure promises. */
const RECEIVED = new Set(["received", "approved"]);

/**
 * Per broker: which flats are theirs, and what those flats have led to.
 *
 * A flat is a broker's when either
 *   - its internal details name them (inventory_private.broker_id), or
 *   - it was posted with their phone number (inventory.phone).
 * The second is what credits the flats brokers listed before the CRM could
 * record a broker at all — without it every existing broker would start at 0.
 * An explicit link always wins: a flat linked to one broker is never also
 * credited to another by phone.
 *
 * Returns Map<broker_id, { propertyIds, flats, active, visits, closures,
 *   revenue, received, lastSharedAt }>.
 */
export function brokerStats({ brokers = [], links = [], inventory = [], bookings = [], clients = [] } = {}) {
  const byPhone = new Map();
  for (const b of brokers) {
    const p = normalizeIndianMobile(b.phone);
    if (p && !byPhone.has(p)) byPhone.set(p, b.id);
  }

  const owner = new Map(); // property_id → broker_id
  for (const l of links) if (l?.property_id && l?.broker_id) owner.set(l.property_id, l.broker_id);
  for (const f of inventory) {
    if (!f?.property_id || owner.has(f.property_id)) continue;
    const id = byPhone.get(normalizeIndianMobile(f.phone));
    if (id) owner.set(f.property_id, id);
  }

  const out = new Map(brokers.map((b) => [b.id, {
    propertyIds: [], flats: 0, active: 0, visits: 0, closures: 0, revenue: 0, received: 0, lastSharedAt: 0,
  }]));
  const listing = new Map(inventory.map((f) => [f.property_id, f]));

  for (const [pid, brokerId] of owner) {
    const s = out.get(brokerId);
    const f = listing.get(pid);
    // A link to a flat that has since been deleted is not a flat they shared.
    if (!s || !f) continue;
    s.propertyIds.push(pid);
    s.flats += 1;
    if (f.status === "published") s.active += 1;
    s.lastSharedAt = Math.max(s.lastSharedAt, ts(f.created_at));
  }

  for (const v of bookings) {
    const s = out.get(owner.get(v?.property_id));
    if (!s || !listing.has(v.property_id)) continue;
    if (String(v.status || "").toLowerCase() === "cancelled") continue;
    s.visits += 1;
  }

  for (const c of clients) {
    if (c?.status !== "closed_by_us" || !c.closed_property_id) continue;
    const s = out.get(owner.get(c.closed_property_id));
    if (!s || !listing.has(c.closed_property_id)) continue;
    const amount = Number(c.brokerage_amount) || 0;
    s.closures += 1;
    s.revenue += amount;
    if (RECEIVED.has(c.payment_status)) s.received += amount;
  }

  return out;
}

export const BROKER_SORTS = [
  { id: "flats", label: "Most flats shared" },
  { id: "revenue", label: "Most revenue" },
  { id: "closures", label: "Most closures" },
  { id: "recent", label: "Shared most recently" },
  { id: "quiet", label: "Longest since a flat" },
  { id: "name", label: "Name" },
];

export function sortBrokers(brokers, stats, sortId) {
  const s = (b) => stats.get(b.id) ?? {};
  const out = [...brokers];
  out.sort((a, b) => {
    switch (sortId) {
      case "revenue": return (s(b).revenue || 0) - (s(a).revenue || 0) || (s(b).flats || 0) - (s(a).flats || 0);
      case "closures": return (s(b).closures || 0) - (s(a).closures || 0) || (s(b).revenue || 0) - (s(a).revenue || 0);
      case "recent": return (s(b).lastSharedAt || 0) - (s(a).lastSharedAt || 0);
      // Brokers who've gone quiet first — the ones worth a nudge for fresh
      // inventory. Never-shared sorts ahead of everyone: they owe us a first.
      case "quiet": return (s(a).lastSharedAt || 0) - (s(b).lastSharedAt || 0);
      case "name": return String(a.name || "").localeCompare(String(b.name || ""));
      case "flats":
      default:
        return (s(b).flats || 0) - (s(a).flats || 0) || (s(b).active || 0) - (s(a).active || 0);
    }
  });
  return out;
}

/**
 * The WhatsApp opener asking a broker for new inventory.
 *
 * Names the areas we have demand in when we know them, because "any flats?"
 * gets a broker's whole list and "2 BHKs in HSR under ₹35k?" gets the ones we
 * can place.
 */
export function inventoryRequestMessage({ brokerName, agentName, areas = [] } = {}) {
  const first = String(brokerName || "").trim().split(/\s+/)[0];
  const where = areas.filter(Boolean).slice(0, 4);
  return [
    `Hi${first ? ` ${first}` : ""}, this is ${String(agentName || "").trim() || "the team"} from MovEazy.`,
    "",
    where.length
      ? `Do you have any flats available for rent in ${where.join(", ")}?`
      : "Do you have any new flats available for rent?",
    "Send over the details — area, BHK, rent, deposit and photos — and we'll get them in front of our tenants.",
  ].join("\n");
}

/** ₹1,23,000 → "₹1.2L"; ₹45,000 → "₹45k". */
export function inrShort(n) {
  const v = Number(n) || 0;
  if (v >= 100000) return `₹${(v / 100000).toFixed(v >= 1000000 ? 0 : 1)}L`;
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
  return `₹${v}`;
}
