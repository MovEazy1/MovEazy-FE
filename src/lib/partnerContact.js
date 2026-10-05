/**
 * Reaching whoever listed a flat from the partner app, and the exact location
 * of another broker's flat (MovEazy-BE/supabase/partner_location.sql).
 *
 *   another broker's flat   call / WhatsApp the listing broker. The area only;
 *                           the address and map pin open when that broker
 *                           approves a request.
 *   an owner's flat         the owner directly, or — if the owner switched
 *                           brokers' calls off — MovEazy's visits desk, which
 *                           gets the flat and the visit wanted in the message.
 *   a MovEazy flat          its POC (owner, tenant or broker), address and all.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { bhkLabel, inr, partnerPropertyLink } from "./partners";

/** Takes brokers' calls for owners who switched them off (partner_location.sql). */
export const VISITS_DESK = "8090911024";

/** Has this listing come with its exact place? Another broker's comes without one until they approve. */
export const hasExactPlace = (l) =>
  Boolean(String(l?.full_address || "").trim()) || (l?.latitude != null && l?.longitude != null);

/** Another broker's flat whose exact location this partner hasn't been given. */
export const locationHidden = (l) => l?.source === "broker" && !hasExactPlace(l);

/** "Sat 11 Oct, 5:00 PM" for a visit slot. */
export const slotLabel = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
    : "";

/**
 * The WhatsApp text to whoever this contact is. The visits desk needs the most:
 * which flat, its link, who is asking, and the visit wanted — it passes all of
 * that on to an owner who isn't taking calls.
 */
export function contactMessage(l, contact, { partnerName = "", agency = "", visitAt = "" } = {}) {
  const what = `${bhkLabel(l)} in ${l?.area || "Bengaluru"}${Number(l?.rent) > 0 ? ` (${inr(l.rent)}/month)` : ""}`;
  const me = [partnerName, agency].filter(Boolean).join(", ");
  const visit = visitAt ? slotLabel(visitAt) : "";
  const link = partnerPropertyLink(l?.property_id);
  if (contact?.role === "moveazy") {
    return [
      "Hi MovEazy, visit request from a MovEazy partner.",
      `Property: ${what} — ${l?.property_id}`,
      link,
      `Broker: ${me || "MovEazy partner"}`,
      `Visit wanted: ${visit || "the earliest time the owner can do — please share the options"}`,
    ].join("\n");
  }
  const first = String(contact?.name || "").split(" ")[0];
  const hi = first ? `Hi ${first}, ` : "Hi, ";
  const intro = me ? `I'm ${me}, a MovEazy partner broker. ` : "";
  const ask = contact?.role === "broker"
    ? "Is it still available? I have a client for it."
    : visit ? `I have a client for it — can we visit on ${visit}?` : "I have a client for it — when can we visit?";
  return `${hi}${intro}${intro ? "About" : "about"} the ${what} (${l?.property_id}) on MovEazy. ${ask}\n${link}`;
}

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** Ask the listing broker for a flat's exact location. → { status: 'pending' | 'approved', already? } */
export const requestLocation = (propertyId, note = "") =>
  rpc("partner_request_location", { p_property: propertyId, p_note: note });

/** The listing broker answers a request. */
export const decideLocation = (requestId, approve) =>
  rpc("partner_decide_location", { p_request: requestId, p_approve: Boolean(approve) });

/** { incoming: requests on my listings, outgoing: my latest request per flat }. */
export const fetchLocationRequests = () =>
  rpc("partner_location_requests_mine").then((r) => ({ incoming: r?.incoming ?? [], outgoing: r?.outgoing ?? [] }));

/* ── The owner's side ────────────────────────────────────────────────────── */

/** May brokers call / WhatsApp the owner about this flat? True unless they switched it off. */
export async function fetchBrokerContact(propertyId) {
  if (!isSupabaseConfigured || !supabase) return true;
  const { data, error } = await supabase
    .from("owner_property_links").select("broker_contact").eq("property_id", propertyId).maybeSingle();
  if (error) throw error;
  return data?.broker_contact !== false;
}

export const setBrokerContact = (propertyId, on) =>
  rpc("owner_set_broker_contact", { p_property: propertyId, p_on: Boolean(on) });
