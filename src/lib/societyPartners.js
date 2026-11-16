/**
 * Society partners (MovEazy-BE/supabase/society_partners.sql): partners who
 * onboard gated societies from the partner app, the CRM's review, the societies
 * tenants then see, and the leads those send to the partner.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { uploadInventoryPhotos } from "./inventory";
import { leadKey } from "./leadIntake";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** The sample flat's photo slots, in the order the app asks for them. */
export const FLAT_SLOTS = [
  { id: "living", label: "Living room" },
  { id: "bedroom", label: "Bedroom" },
  { id: "kitchen", label: "Kitchen" },
  { id: "bathroom", label: "Bathroom" },
  { id: "balcony", label: "Balcony / view" },
  { id: "other", label: "Anything else" },
];
export const slotLabel = (id) => FLAT_SLOTS.find((s) => s.id === id)?.label ?? id;

/** Rent range keys a partner fills: 1 RK, 1–4 BHK. */
export const RENT_TYPES = [
  { id: "1rk", label: "1 RK" }, { id: "1", label: "1 BHK" }, { id: "2", label: "2 BHK" }, { id: "3", label: "3 BHK" }, { id: "4", label: "4 BHK" },
];

export const CONTACT_KINDS = [
  { id: "manager", label: "Property manager", many: false },
  { id: "guard", label: "Security guard", many: true },
  { id: "broker", label: "Broker", many: true },
];

export const ONBOARD_STATUS = {
  draft: { label: "Draft", tone: "#8A6419" },
  sent_back: { label: "Sent back", tone: "#B91C1C" },
  submitted: { label: "With MovEazy for review", tone: "#1D4ED8" },
  approved: { label: "Live", tone: "#15803D" },
};

export const LEAD_STAGES = [
  { id: "new", label: "New" },
  { id: "called", label: "Called" },
  { id: "visit_set", label: "Visit set" },
  { id: "visit_done", label: "Visit done" },
  { id: "closed", label: "Closed" },
  { id: "lost", label: "Lost" },
];
export const stageLabel = (id) => LEAD_STAGES.find((s) => s.id === id)?.label ?? id;

/** "850 m", "2.4 km". */
export function distanceLabel(m) {
  if (m == null) return "";
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Where the phone is now: { lat, lng, accuracy }. Rejects with a sentence a partner can act on. */
export function currentSpot({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("This phone can't share its location.")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1
        ? "Location is off for MovEazy. Allow location in your browser settings to add societies and photos."
        : "Couldn't find your location. Step outside or turn on GPS, then try again.")),
      { enableHighAccuracy: true, timeout, maximumAge: 20000 },
    );
  });
}

/* ── Partner app ──────────────────────────────────────────────────────────── */

export const fetchNearbySocieties = (lat, lng) => rpc("partner_societies_nearby", { p_lat: lat ?? null, p_lng: lng ?? null }).then((r) => r ?? []);
export const fetchMySocieties = () => rpc("partner_my_societies").then((r) => r ?? []);
export const fetchMySociety = (id) => rpc("partner_society_get", { p_id: id });
export const startSociety = (id) => rpc("partner_society_start", { p_id: id });
export const addSociety = ({ name, lat, lng, area = "", road = "other" }) =>
  rpc("partner_society_add", { p_name: name, p_lat: lat, p_lng: lng, p_area: area, p_road: road });
export const saveSociety = (p) => rpc("partner_society_save", { p });
export const saveSocietyContact = (p) => rpc("partner_society_contact_save", { p });
export const removeSocietyContact = (id) => rpc("partner_society_contact_remove", { p_id: id });
export const submitSociety = (id) => rpc("partner_society_submit", { p_id: id });
export const fetchSocietyLeads = () => rpc("partner_society_leads").then((r) => r ?? []);
export const updateSocietyLead = (id, stage, note = "") => rpc("partner_society_lead_update", { p_lead: id, p_stage: stage, p_note: note }).then((r) => r ?? []);
export const removeSocietyPhoto = (id, kind, slot, url) => rpc("partner_society_photo_remove", { p_id: id, p_kind: kind, p_slot: slot, p_url: url });

/**
 * A photo taken at the society: upload it (shrunk, with its thumbnail) to the
 * partner's folder for this society, then record it with where the phone was.
 * The database refuses it if the phone is more than 300 m from the society.
 */
export async function addSocietyPhoto({ society, partnerId, kind, slot, file }) {
  const spot = await currentSpot();
  const folder = `SP-${String(society.id).slice(0, 8)}-${String(partnerId).slice(0, 8)}`;
  let why = "";
  const [url] = await uploadInventoryPhotos([file], folder, null, (_f, msg) => { why = msg; });
  if (!url) throw new Error(why || "That photo didn't upload. Try again.");
  return rpc("partner_society_photo_add", { p_id: society.id, p_kind: kind, p_slot: slot, p_url: url, p_lat: spot.lat, p_lng: spot.lng });
}

/* ── CRM ──────────────────────────────────────────────────────────────────── */

export const fetchSocietyPartnerIds = () => rpc("crm_society_partner_ids").then((r) => new Set(r ?? []));
export const setSocietyPartner = (userId, on) => rpc("crm_society_partner_set", { p_user: userId, p_on: on });
export const decideSocietyOnboard = (id, approve, note = "") => rpc("crm_society_onboard_decide", { p_id: id, p_approve: approve, p_note: note });
export const setSocietyLive = (id, live) => rpc("crm_society_live_set", { p_id: id, p_live: live });
export const fetchCrmSocietyLeads = () => rpc("crm_society_leads").then((r) => r ?? []);

/* ── Tenants ──────────────────────────────────────────────────────────────── */

export const fetchLiveSocieties = (lat = null, lng = null) => rpc("societies_live", { p_lat: lat, p_lng: lng }).then((r) => r ?? []);
export const fetchLiveSociety = (code) => rpc("society_live", { p_code: code });

/** "Get flats": the lead goes to the partner; returns { society, partner_first_name, partner_phone }. */
export const enquireSociety = (code) => rpc("society_enquire", { p_code: code, p_lead_key: leadKey() || null });

/** The WhatsApp message to the partner, as agreed. */
export function partnerWhatsApp(phone, firstName, society) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  const text = `Hi ${firstName || "there"}, I am Interested in a flat in ${society} & got your contact via MovEazy. Can you please share the available options at the earliest.`;
  return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
}
