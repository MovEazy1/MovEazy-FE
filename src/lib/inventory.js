import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Inventory = the supply side. One row per listed home in the Supabase
 * `inventory` table (see MovEazy-BE/supabase/inventory_schema.sql). Fields
 * mirror the Train My Broker requirement vocabulary so a listing can be scored
 * against a customer search profile in lib/inventoryMatch.js.
 */

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
const PHOTO_BUCKET = "listings"; // reuse the existing public storage bucket

/**
 * Bulk-upload listing photos to Supabase Storage and return their public URLs.
 * Best-effort per file: a single failed upload is skipped, not fatal, so a flaky
 * photo never blocks publishing. `onProgress(done, total)` reports as it goes.
 */
export async function uploadInventoryPhotos(files = [], propertyId, onProgress) {
  if (!isSupabaseConfigured || !supabase || !files.length) return [];
  const urls = [];
  let done = 0;
  for (const file of files) {
    try {
      const safeName = String(file.name || "photo").replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
      const path = `inventory/${propertyId}/${Date.now()}-${safeName}`;
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
      if (!error && data) {
        const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(data.path);
        if (pub?.publicUrl) urls.push(pub.publicUrl);
      }
    } catch { /* skip this file */ }
    done += 1;
    onProgress?.(done, files.length);
  }
  return urls;
}

/** Short shareable id: MZ-XXXXXX. */
export function generatePropertyId() {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `MZ-${s}`;
}

function num(v, fallback = null) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function list(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim()).filter(Boolean);
}

/**
 * Build the DB row from the List my Flat form draft. `poster` is the signed-in
 * auth user; `postedBy` is the role they claimed (tenant|broker|owner). The
 * matching id column is filled from the poster's uid based on that role.
 */
export function buildInventoryRow(draft, poster) {
  const postedBy = ["tenant", "broker", "owner"].includes(draft.postedBy) ? draft.postedBy : "owner";
  const uid = poster?.uid || poster?.id || null;
  return {
    property_id: draft.propertyId || generatePropertyId(),
    posted_by: postedBy,
    poster_id: uid,
    tenant_id: postedBy === "tenant" ? uid : null,
    broker_id: postedBy === "broker" ? uid : null,
    owner_id: postedBy === "owner" ? uid : null,
    poster_name: String(poster?.name || poster?.email?.split("@")[0] || "").slice(0, 120),
    poster_email: String(poster?.email || "").toLowerCase().trim(),
    phone: String(draft.phone || "").trim().slice(0, 20),

    city: "Bengaluru",
    area: String(draft.area || "").trim(),
    nearby_areas: list(draft.nearbyAreas),
    full_address: String(draft.fullAddress || "").trim().slice(0, 400),
    landmark: String(draft.landmark || "").trim().slice(0, 200),
    latitude: num(draft.latitude),
    longitude: num(draft.longitude),

    rent: num(draft.rent, 0),
    deposit: num(draft.deposit, 0),
    available_from: draft.availableFrom || null,

    flat_type: String(draft.flatType || "").trim(),
    bedrooms: num(draft.bedrooms, 1),
    bathrooms: num(draft.bathrooms, 1),
    furnishing: String(draft.furnishing || "Unfurnished").trim(),
    max_flatmates: num(draft.maxFlatmates, 0),
    gender_pref: String(draft.genderPref || "any").trim(),
    occupants_allowed: list(draft.occupantsAllowed),
    amenities: list(draft.amenities),
    lifestyle: list(draft.lifestyle),
    house_rules: list(draft.houseRules),

    title: String(draft.title || "").trim().slice(0, 160),
    description: String(draft.description || "").trim().slice(0, 2000),
    images: list(draft.images),
    cover_image_url: list(draft.images)[0] || "",

    status: "published",
    updated_at: new Date().toISOString(),
  };
}

/**
 * Insert a listing. Retries once with a fresh property_id if the generated code
 * collides (unique PK violation → Postgres code 23505).
 */
export async function createInventoryItem(draft, poster) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured");
  let row = buildInventoryRow(draft, poster);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from("inventory").insert(row).select().single();
    if (!error) return data;
    if (error.code === "23505") {
      row = { ...row, property_id: generatePropertyId() };
      continue;
    }
    throw error;
  }
  throw new Error("Could not generate a unique property id — please try again.");
}

/** All published inventory (for matching / listings). */
export async function fetchPublishedInventory({ limit = 500 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

/**
 * Adapt a published inventory row (snake_case DB shape) to the listing shape the
 * map/discovery UI expects (l.bhk, l.price, l.seller, l.image, …), so user-uploaded
 * homes appear on the map alongside the static feed.
 */
export function mapInventoryToListing(row) {
  if (!row) return null;
  const rent = num(row.rent, 0);
  const images = list(row.images);
  const cover = String(row.cover_image_url || images[0] || "").trim();
  const address =
    String(row.full_address || "").trim() ||
    [row.landmark, row.area].filter(Boolean).join(", ") ||
    String(row.area || "").trim();
  const roleLabel =
    row.posted_by === "broker" ? "Broker" : row.posted_by === "tenant" ? "Tenant" : "Owner";
  return {
    id: row.property_id,
    lat: num(row.latitude),
    lng: num(row.longitude),
    bhk: String(row.flat_type || "").trim(),
    monthlyRent: rent,
    price: rent ? `₹${rent.toLocaleString("en-IN")}/mo` : "",
    title: String(row.title || "").trim() || `${row.flat_type || "Home"} in ${row.area || "Bengaluru"}`,
    address,
    location: String(row.area || "").trim(),
    seller: String(row.poster_name || "MovEazy").trim(),
    sellerEmail: String(row.poster_email || "").trim(),
    contact: String(row.phone || "").trim(),
    company: roleLabel,
    image: cover,
    images,
    furnishing: String(row.furnishing || "").trim(),
    availability: row.available_from ? "Available soon" : "Immediate",
    propertyType: "Apartment",
    amenities: list(row.amenities),
    postedBy: row.posted_by,
    source: "inventory",
  };
}

/** Published inventory already mapped to the map/discovery listing shape. */
export async function fetchInventoryAsListings(opts = {}) {
  const rows = await fetchPublishedInventory(opts);
  return rows.map(mapInventoryToListing).filter((l) => l && Number.isFinite(l.lat) && Number.isFinite(l.lng));
}

/** Every saved customer search profile (the demand side) for matching. */
export async function fetchAllSearchProfiles({ limit = 1000 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("customer_search_profiles")
    .select("*")
    .limit(limit);
  if (error) return [];
  return data || [];
}
