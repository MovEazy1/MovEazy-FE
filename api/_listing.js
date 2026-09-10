/**
 * Shared listing lookup for the share endpoints.
 *
 * Runs in Vercel's edge runtime, so it talks to Supabase over REST rather than
 * with the JS client. Uses the same publishable key the browser uses — the
 * `inventory` table already allows anyone to read published rows, which is
 * exactly the set of listings we'd ever put a public preview on.
 *
 * Vercel exposes every project env var to functions, so the VITE_-prefixed ones
 * already configured for the build are readable here too. No new setup.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const FIELDS =
  "property_id,title,area,city,rent,deposit,flat_type,bedrooms,bathrooms," +
  "furnishing,amenities,description,images,cover_image_url,status";

/** A published listing, or null. Never throws — a preview must not 500. */
export async function fetchListing(propertyId) {
  const id = String(propertyId || "").trim().toUpperCase();
  if (!id || !SUPABASE_URL || !SUPABASE_KEY) return null;

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/inventory` +
      `?select=${encodeURIComponent(FIELDS)}` +
      `&property_id=eq.${encodeURIComponent(id)}` +
      `&status=eq.published&limit=1`;

    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}

// A listing's media lives in one array, videos included. Satori draws stills —
// an <img> pointed at an .mp4 renders as a blank tile — so the collage takes
// photos only, and a video-only listing falls through to the branded card.
// Deliberately duplicated from src/lib/listingMedia.js: this runs in the edge
// runtime, which bundles from api/ alone.
const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|qt|3gp)(?:[?#]|$)/i;

/** Up to `max` usable photo URLs, cover first, de-duplicated, no videos. */
export function photosOf(listing, max = 4) {
  const all = [listing?.cover_image_url, ...(listing?.images ?? [])]
    .map((u) => String(u || "").trim())
    .filter((u) => u.startsWith("http") && !VIDEO_EXT.test(u));
  return [...new Set(all)].slice(0, max);
}

export const inr = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "";

/** "2 BHK in Bellandur — ₹22,500" */
export function listingTitle(listing) {
  if (!listing) return "MovEazy — find your next home";
  const kind = listing.flat_type || "Home";
  const where = listing.area || listing.city || "Bengaluru";
  const rent = inr(listing.rent);
  return rent ? `${kind} in ${where} — ${rent}` : `${kind} in ${where}`;
}

export function listingDescription(listing) {
  if (!listing) return "Real listings, verified owners, deposit protection.";
  const bits = [
    listing.furnishing,
    listing.bedrooms ? `${listing.bedrooms} bed` : "",
    listing.bathrooms ? `${listing.bathrooms} bath` : "",
    listing.deposit ? `${inr(listing.deposit)} deposit` : "",
    ...(listing.amenities ?? []).slice(0, 3),
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : String(listing.description || "").slice(0, 160);
}

/** Escape for interpolation into an HTML attribute. */
export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
