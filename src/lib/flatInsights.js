/**
 * Every flat's QR, its numbers (leads = QR scans, likes, visits) and the
 * feedback the MovEazy team records from renters. The QR opens the flat's own
 * page, moveazy.co.in/property/<id>?s=qr.
 *
 * The authority is MovEazy-BE/supabase/flat_insights.sql: who sees a number
 * and who writes feedback is decided there. This file only calls it.
 */
import { trackPixel } from "./metaPixel";
import { supabase, isSupabaseConfigured } from "./supabase";
import { PUBLIC_ORIGIN } from "./partners";
import { visitorId } from "./storefront";
import { BUILDING_POSTER, CLASSIC_POSTER, FLAT_POSTER, RED_TOLET_POSTER, STREET_POSTERS, headlineBhk, loadImage, posterFontsReady, posterPdf, toLetHeadline } from "./qrPoster";
import { buildingDisplay, buildingUrl } from "./buildings";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const flatUrl = (propertyId, { qr = false } = {}) =>
  `${PUBLIC_ORIGIN}/property/${encodeURIComponent(propertyId)}${qr ? "?s=qr" : ""}`;
export const flatDisplay = (propertyId) => `moveazy.co.in/property/${propertyId}`;

/** Count this visitor's open of a flat's page (the QR adds ?s=qr). Never throws. */
export function recordFlatView(propertyId, source) {
  trackPixel("ViewContent", { content_ids: [String(propertyId || "")], content_type: "home_listing", content_name: source || "link" });
  return rpc("flat_view", {
    p_property: String(propertyId || ""), p_visitor: visitorId() || "anonymous-visitor", p_source: source === "qr" ? "qr" : "link",
  }).catch(() => {});
}

/* ── Owner ───────────────────────────────────────────────────────────────── */
export const fetchRentDashboard = () => rpc("owner_rent_dashboard").then((r) => r ?? []);
export const fetchOwnerFlatInsights = (propertyId) => rpc("owner_flat_insights", { p_property: propertyId });
/**
 * Every open of the owner's flats' and buildings' pages, and the people behind
 * them, with their contact (owner_qr_overview.sql):
 * { scans, week, people, visited, by_place: [...], list: [...] }
 */
export const fetchQrOverview = () => rpc("owner_qr_overview");

/* ── CRM ─────────────────────────────────────────────────────────────────── */
export const fetchCrmFlatInsights = (propertyId) => rpc("crm_flat_insights", { p_property: propertyId });
export const addFlatFeedback = (propertyId, fb) => rpc("crm_flat_feedback_add", { p_property: propertyId, p: fb });
export const deleteFlatFeedback = (id) => rpc("crm_flat_feedback_delete", { p_id: id });

/** How a renter found the rent, in words, with a tone for pills. */
export const PRICE_VIEWS = [
  { id: "too_high", label: "Too high", tone: "red" },
  { id: "bit_high", label: "A bit high", tone: "amber" },
  { id: "fair", label: "Fair", tone: "green" },
  { id: "good_value", label: "Good value", tone: "champ" },
];
export const priceViewLabel = (id) => PRICE_VIEWS.find((p) => p.id === id)?.label || "";

export const FEEDBACK_SOURCES = [
  { id: "visit", label: "After a visit" },
  { id: "call", label: "On a call" },
  { id: "whatsapp", label: "On WhatsApp" },
  { id: "qr", label: "From the QR page" },
  { id: "other", label: "Other" },
];

export const EMPTY_STATS = { scans: 0, opens: 0, likes: 0, visits: 0, feedback: 0, rating: null, price_views: {} };

/* ── Posters ─────────────────────────────────────────────────────────────── */

/**
 * The two numbers printed on the red To-Let poster (poster_phone.sql): a
 * flat's own pair, or a building's — set by the CRM or the owner, never
 * carried from one to the other. `{ phone, phone2 }`.
 */
export const fetchPosterPhone = ({ propertyId = null, buildingId = null }) =>
  rpc("poster_phone_get", { p_property: propertyId || null, p_building: buildingId || null }).then((r) => r ?? {});
/** Save the pair on the flat (a propertyId) or else on the building; both "" clears it. Returns `{ phone, phone2 }` as saved. */
export const savePosterPhone = ({ propertyId = null, buildingId = null }, phone, phone2) =>
  rpc("poster_phone_set", { p_property: propertyId || null, p_building: buildingId || null, p_phone: String(phone ?? ""), p_phone2: String(phone2 ?? "") });

/** "TO-LET 2BHK FLAT" for a flat, or for a building from its flats' types (`building.bhks`). */
export const defaultToLetHeadline = ({ flat, building }) =>
  toLetHeadline(building ? (building.bhks ?? [building.bhk]) : [flat?.flat_type || (flat?.bedrooms ? `${flat.bedrooms} BHK` : "")]);

const bhk = (p) => p?.flat_type || (p?.bedrooms ? `${p.bedrooms} BHK` : "Flat");
const rupees = (n) => (Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "");

/**
 * What a poster needs, for one flat or for the building it is in.
 * `flat`: an inventory-shaped row (property_id, flat_type, area, rent, images…).
 * `building`: { code, name, area, landmark, photo, available, rentFrom } to print the building's poster instead.
 * The red To-Let also takes `headline` (else "TO-LET 2BHK FLAT" from the types) and `phones`, one per line.
 */
export async function posterData({ flat, building, logoSrc, style = "photo", lightLogoSrc, headline, phones }) {
  if (style === RED_TOLET_POSTER.id) {
    // The red To-Let: the headline (as edited), the QR, the poster's two numbers.
    const [logoLight] = await Promise.all([loadImage(lightLogoSrc || logoSrc), posterFontsReady()]);
    return {
      design: RED_TOLET_POSTER.id,
      data: {
        headline: String(headline ?? "").trim() || defaultToLetHeadline({ flat, building }),
        phones: (phones ?? []).filter(Boolean),
        url: building ? buildingUrl(building.code, { qr: true }) : flatUrl(flat.property_id, { qr: true }),
        logoLight,
      },
    };
  }
  if (STREET_POSTERS.some((d) => d.id === style)) {
    // The A1 street posters: the type, the rent, how many — big.
    const [logo, logoDark] = await Promise.all([loadImage(lightLogoSrc || logoSrc), loadImage(logoSrc), posterFontsReady()]);
    const type = headlineBhk(building ? building.bhk : flat?.flat_type || (flat?.bedrooms ? `${flat.bedrooms}BHK` : ""));
    return {
      design: style,
      data: {
        headline: { accent: type || "Homes" },
        rentFrom: building ? building.rentFrom || "" : rupees(flat?.rent),
        rentIsFrom: Boolean(building),
        available: building ? Number(building.available) || 0 : 0,
        url: building ? buildingUrl(building.code, { qr: true }) : flatUrl(flat.property_id, { qr: true }),
        displayUrl: building ? buildingDisplay(building.code) : flatDisplay(flat.property_id),
        logo, logoDark,
      },
    };
  }
  if (style === "classic") {
    // "Premium 2BHK for Rent": the flat's type, or the building's when all its flats share one.
    const [logo] = await Promise.all([loadImage(lightLogoSrc || logoSrc), posterFontsReady()]);
    const type = headlineBhk(building ? building.bhk : flat?.flat_type || (flat?.bedrooms ? `${flat.bedrooms}BHK` : ""));
    return {
      design: CLASSIC_POSTER.id,
      data: {
        headline: { lead: "Premium", accent: type || "Homes", tail: "for Rent" },
        url: building ? buildingUrl(building.code, { qr: true }) : flatUrl(flat.property_id, { qr: true }),
        logo,
      },
    };
  }
  const cover = building?.photo || flat?.cover_image_url || (flat?.images ?? []).find((u) => !/\.(mp4|mov|webm)(\?|$)/i.test(u)) || "";
  const [photo, logo] = await Promise.all([loadImage(cover), loadImage(logoSrc), posterFontsReady()]);
  if (building) {
    return {
      design: BUILDING_POSTER.id,
      data: {
        building: { name: building.name, area: building.area, landmark: building.landmark, available: building.available, rentFrom: building.rentFrom },
        url: buildingUrl(building.code, { qr: true }), displayUrl: buildingDisplay(building.code), photo, logo,
      },
    };
  }
  return {
    design: FLAT_POSTER.id,
    data: {
      building: {
        name: `${bhk(flat)}${flat?.furnishing ? ` · ${flat.furnishing}` : ""}`,
        area: flat?.area || "Bengaluru",
        landmark: flat?.landmark || "",
        pitch: [rupees(flat?.rent) ? `${rupees(flat.rent)} / month` : "", "Available now"].filter(Boolean).join("  ·  "),
        headline: "Scan to see this home",
        subline: "photos, rent & book a visit",
        steps: ["Scan", "See the home", "Book a visit"],
        tag: "For rent",
      },
      url: flatUrl(flat.property_id, { qr: true }), displayUrl: flatDisplay(flat.property_id), photo, logo,
    },
  };
}

/** Download a poster as an A4 PDF. */
export async function downloadPoster({ design, data }, filename) {
  const blob = await posterPdf(design, data);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}
