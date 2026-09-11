import { supabase, isSupabaseConfigured } from "./supabase";
import { coverMedia, coverPhoto, isVideoFile, orderListingMedia } from "./listingMedia";

/**
 * Inventory = the supply side. One row per listed home in the Supabase
 * `inventory` table (see MovEazy-BE/supabase/inventory_schema.sql). Fields
 * mirror the Train My Broker requirement vocabulary so a listing can be scored
 * against a customer search profile in lib/inventoryMatch.js.
 */

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
const PHOTO_BUCKET = "listings"; // reuse the existing public storage bucket

/** A phone shoots ~7 MB a minute at 1080p; 60 MB is a generous walkthrough and
 *  still inside what Supabase Storage accepts in one upload. */
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Whether this file can be uploaded, and if not, why — in words a poster can
 *  act on. Callers show the reason; nothing is dropped silently. */
export function mediaRejectionReason(file) {
  const video = isVideoFile(file);
  const cap = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > cap) {
    return `${file.name || (video ? "That video" : "That photo")} is ${(file.size / 1048576).toFixed(0)} MB — the limit is ${cap / 1048576} MB`;
  }
  return "";
}

/**
 * Bulk-upload listing photos and videos to Supabase Storage and return their
 * public URLs. Best-effort per file: a single failed upload is skipped, not
 * fatal, so a flaky photo never blocks publishing. `onProgress(done, total)`
 * reports as it goes.
 *
 * `onFileError(file, message)` is how a skipped file gets said out loud. It
 * matters most for video: if the storage bucket rejects the type or the size,
 * every photo still uploads and the walkthrough just isn't there — a poster who
 * isn't told will believe they published it.
 */
export async function uploadInventoryPhotos(files = [], propertyId, onProgress, onFileError) {
  if (!isSupabaseConfigured || !supabase || !files.length) return [];
  const urls = [];
  let done = 0;
  for (const file of files) {
    try {
      const safeName = String(file.name || "photo").replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
      const path = `inventory/${propertyId}/${Date.now()}-${safeName}`;
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || (isVideoFile(file) ? "video/mp4" : "image/jpeg"),
        });
      if (!error && data) {
        const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(data.path);
        if (pub?.publicUrl) urls.push(pub.publicUrl);
      } else if (error) {
        onFileError?.(file, error.message || "Upload failed");
      }
    } catch (e) {
      onFileError?.(file, e?.message || "Upload failed");
    }
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
    // Null, not 0: "the lister didn't say" is not "the lister said zero", and
    // the property page shows no maintenance row for the former.
    maintenance: draft.maintenance === "" || draft.maintenance == null ? null : num(draft.maintenance, 0),
    // Null rather than 0 — the ground floor is a real answer, so 0 can't
    // double as "not stated".
    floor_number: draft.floorNumber === "" || draft.floorNumber == null ? null : num(draft.floorNumber, 0),
    total_floors: draft.totalFloors === "" || draft.totalFloors == null ? null : num(draft.totalFloors, 0),
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
    // Stored in the order they're shown in, so every reader — the app, an
    // export, someone looking at the table — sees the same listing.
    images: orderListingMedia(list(draft.images)),
    cover_image_url: coverPhoto(list(draft.images)),

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
    // A column a pending migration hasn't added must not stop someone
    // publishing. Drop it and post the listing without that one field.
    if (isMissingColumn(error)) {
      console.warn(`[inventory] insert: ${error.message} — publishing without it. Run the pending migration.`);
      row = withoutOptionalColumns(row);
      continue;
    }
    throw error;
  }
  throw new Error("Could not generate a unique property id — please try again.");
}

// The public map / discovery feed is readable while signed out, so it must not
// carry a poster's private contact details or user ids. This is the exact set
// the anon Postgres role is allowed to read (see inventory RLS: column grants
// to anon exclude phone/poster_email/poster_name/poster_id/owner_id/tenant_id/
// broker_id). Selecting "*" here would ask for columns anon can't read and fail
// the whole request for signed-out visitors — so name the safe columns instead.
// Contact details are resolved separately, only for a viewer who's entitled to
// them (canReadListingPrivatePhones), never from this public list.
/**
 * Columns added by a migration that may not have been applied yet.
 *
 * Migrations here are run by hand in the Supabase editor, out of band from a
 * deploy, so for a window the code asks for a column the database hasn't got.
 * PostgREST answers a select naming an unknown column by rejecting the whole
 * request — which empties the public map, not just the one field. Measured:
 * 54 listings became 0.
 *
 * So these are asked for, and dropped on the one error that means "not yet".
 */
const OPTIONAL_INVENTORY_COLS = ["maintenance", "floor_number", "total_floors"];

/**
 * "The database won't give me that column."
 *
 * Two different causes, one response. Postgres says 42703 when the column
 * doesn't exist, and PostgREST says PGRST204 on a write naming an unknown one.
 * But a column can also exist and be ungranted: `inventory` gives the anon role
 * an explicit column list, so a newly added column is readable by signed-in
 * users and refused — 42501, "permission denied for table" — to everyone signed
 * out. That failure hides completely from anyone testing while logged in, and
 * it takes the whole select down with it, not just the one field. It cost the
 * public map every listing until a signed-out visitor reported it.
 */
export const isMissingColumn = (error) =>
  error?.code === "42703" ||
  error?.code === "PGRST204" ||
  error?.code === "42501" ||
  /column .* does not exist/i.test(error?.message || "") ||
  /could not find the '.*' column/i.test(error?.message || "") ||
  /permission denied for table/i.test(error?.message || "");

/** The same row without the columns a pending migration hasn't added. */
export function withoutOptionalColumns(row) {
  const copy = { ...row };
  for (const col of OPTIONAL_INVENTORY_COLS) delete copy[col];
  return copy;
}

/**
 * Run a select, and if the database is missing one of the optional columns,
 * run it once more without them rather than returning nothing.
 */
async function selectTolerantly(table, cols, shape = (q) => q) {
  const attempt = (columns) => shape(supabase.from(table).select(columns));
  const { data, error } = await attempt(cols);
  if (!error) return { data, error: null };
  if (!isMissingColumn(error)) return { data: null, error };

  const trimmed = cols
    .split(",")
    .map((c) => c.trim())
    .filter((c) => !OPTIONAL_INVENTORY_COLS.includes(c))
    .join(", ");
  console.warn(
    `[inventory] ${table}: ${error.message} — retrying without ${OPTIONAL_INVENTORY_COLS.join(", ")}. Run the pending migration.`,
  );
  return attempt(trimmed);
}

const PUBLIC_INVENTORY_COLS =
  "property_id, posted_by, city, area, nearby_areas, full_address, landmark, " +
  "latitude, longitude, rent, deposit, available_from, flat_type, bedrooms, " +
  "bathrooms, furnishing, max_flatmates, gender_pref, occupants_allowed, maintenance, " +
  "floor_number, total_floors, " +
  "amenities, lifestyle, house_rules, title, description, images, " +
  "cover_image_url, status, is_verified, view_count, created_at, updated_at";

/** All published inventory (for matching / listings) — public, no poster PII. */
export async function fetchPublishedInventory({ limit = 500 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await selectTolerantly(
    "inventory",
    PUBLIC_INVENTORY_COLS,
    (q) => q.eq("status", "published").order("created_at", { ascending: false }).limit(limit),
  );
  if (error) return [];
  return data || [];
}

/**
 * Every property the signed-in user has posted, newest first — whatever role they
 * posted as (owner / tenant / broker) and whatever its status.
 *
 * No extra grants are needed: the inventory read policy already allows
 * `poster_id = auth.uid()`, so a poster sees their own rows even while paused or
 * rented, and still cannot see anyone else's unpublished stock.
 */
export async function fetchMyInventory(uid) {
  if (!isSupabaseConfigured || !supabase || !uid) return [];
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("poster_id", uid)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

/** A specific set of listings by property_id — for the "Shortlists" page, where
 * a liked listing may not be in the visit cart's own lightweight snapshots. */
/**
 * Listings by id, readable signed out.
 *
 * Not select("*"): the anon role holds column grants rather than table-wide
 * select, so asking for every column is refused outright and the caller gets
 * nothing. A shared link opened in a private window is exactly that case.
 */
export async function fetchInventoryByIds(propertyIds = []) {
  if (!isSupabaseConfigured || !supabase || !propertyIds.length) return [];
  const { data, error } = await selectTolerantly(
    "inventory",
    PUBLIC_INVENTORY_COLS,
    (q) => q.in("property_id", propertyIds),
  );
  if (error) return [];
  return data || [];
}

/** Cheap count for deciding whether to surface "My Properties" in the nav. */
export async function countMyInventory(uid) {
  if (!isSupabaseConfigured || !supabase || !uid) return 0;
  const { count, error } = await supabase
    .from("inventory")
    .select("property_id", { count: "exact", head: true })
    .eq("poster_id", uid);
  if (error) return 0;
  return count || 0;
}

/** Whether this user has posted at least one property specifically as an owner
 * (posted_by = "owner", not tenant/broker) — decides whether the mobile bottom
 * bar switches to the owner-focused set (Home / My Properties / Tenant
 * Management / Rent Management). */
export async function hasOwnerListing(uid) {
  if (!isSupabaseConfigured || !supabase || !uid) return false;
  const { count, error } = await supabase
    .from("inventory")
    .select("property_id", { count: "exact", head: true })
    .eq("poster_id", uid)
    .eq("posted_by", "owner");
  if (error) return false;
  return (count || 0) > 0;
}

/**
 * Adapt a published inventory row (snake_case DB shape) to the listing shape the
 * map/discovery UI expects (l.bhk, l.price, l.seller, l.image, …), so user-uploaded
 * homes appear on the map alongside the static feed.
 */
export function mapInventoryToListing(row) {
  if (!row) return null;
  const rent = num(row.rent, 0);
  const images = orderListingMedia(list(row.images));
  // Prefer a still, but a video-only listing still needs a thumbnail — the
  // card components render either.
  const storedCover = String(row.cover_image_url || "").trim();
  const cover = coverMedia([storedCover, ...images]);
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

    // These are all selected by PUBLIC_INVENTORY_COLS and were being dropped
    // here, so the listing view fell back to inventing them: the deposit showed
    // as 2.5x rent rather than what the owner actually asked, and every listing
    // rendered the same placeholder marketing paragraph instead of its own
    // description. Pass them through.
    securityDeposit: num(row.deposit, 0),
    maintenanceCost: row.maintenance == null ? "" : String(row.maintenance),
    // The property page has always had a Floor row; until now nothing filled it.
    floorNumber: row.floor_number == null ? "" : String(row.floor_number),
    totalFloors: row.total_floors == null ? "" : String(row.total_floors),
    description: String(row.description || "").trim(),
    houseRules: list(row.house_rules),
    preferredTenants: list(row.occupants_allowed),
    lifestyle: list(row.lifestyle),
    bedrooms: num(row.bedrooms),
    bathrooms: num(row.bathrooms),
    availableFrom: row.available_from || "",
    postedAt: row.created_at || "",
    landmark: String(row.landmark || "").trim(),
    nearbyAreas: list(row.nearby_areas),
    isVerified: Boolean(row.is_verified),
  };
}

/** Published inventory already mapped to the map/discovery listing shape. */
export async function fetchInventoryAsListings(opts = {}) {
  const rows = await fetchPublishedInventory(opts);
  return rows.map(mapInventoryToListing).filter((l) => l && Number.isFinite(l.lat) && Number.isFinite(l.lng));
}

/**
 * Change a listing's status. RLS ("posters update own inventory") lets the poster
 * (or an admin) do this. Setting anything other than 'published' removes it from the
 * public map/discovery (which read `status = 'published'`).
 */
export async function setInventoryStatus(propertyId, status) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("inventory")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("property_id", propertyId);
  if (error) throw error;
}

/** Mark a property as sold/closed — removes it from the public platform. Reversible via setInventoryStatus(id, 'published'). */
export async function markInventorySold(propertyId) {
  return setInventoryStatus(propertyId, "sold");
}

const VIEWED_THIS_SESSION = new Set();

/**
 * Record that a renter opened a listing's detail view — bumps inventory.view_count
 * via the increment_listing_view() RPC (see MovEazy-BE/supabase/owner_dashboard_stats.sql),
 * since the poster-only "update own inventory" RLS policy can't let a random viewer
 * touch someone else's row directly. Best-effort and silent: a failed/blocked view
 * count should never interrupt browsing. De-duped per propertyId per browser tab
 * (sessionStorage-backed via an in-memory Set) so re-opening the same card a few
 * times in one visit doesn't inflate the count.
 */
export async function recordListingView(propertyId) {
  if (!isSupabaseConfigured || !supabase || !propertyId) return;
  if (VIEWED_THIS_SESSION.has(propertyId)) return;
  VIEWED_THIS_SESSION.add(propertyId);
  try {
    await supabase.rpc("increment_listing_view", { pid: propertyId });
  } catch {
    /* best-effort — a view count is never worth surfacing an error for */
  }
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
