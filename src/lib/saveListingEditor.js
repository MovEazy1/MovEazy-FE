import { isFirebaseConfigured } from "./firebase";
import { upsertListing } from "./store";
import {
  upsertListingData,
  upsertListingPrivateData,
} from "./firestoreStore";
import { reportClientError } from "./clientLog";
import { toList } from "./listingEditor";
import { supabase, isSupabaseConfigured } from "./supabase";

async function uploadFilesToSupabase(files = [], listingId) {
  const urls = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
    const path = `listings/${listingId}/${Date.now()}-${safeName}`;
    const { data, error } = await supabase.storage
      .from("listings")
      .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("listings").getPublicUrl(data.path);
    urls.push(publicUrl);
  }
  return urls;
}

/**
 * Same save pipeline as Admin → Create listing.
 */
export async function saveListingFromEditor({
  form,
  pinPosition,
  photoFiles = [],
  editingId = null,
  existingListing = null,
  actorUser,
  extraFields = {},
}) {
  const rawSeller = String(form.sellerEmail || "").trim().toLowerCase();
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawSeller);
  const fallbackEmail = String(actorUser?.email || "").trim().toLowerCase();
  const email = looksLikeEmail ? rawSeller : fallbackEmail;

  let monthlyRent = Number(form.monthlyRent);
  if (!Number.isFinite(monthlyRent) || monthlyRent < 0) monthlyRent = 0;
  const digitsFromPrice = parseInt(String(form.price || "").replace(/\D/g, ""), 10) || 0;
  if (monthlyRent <= 0 && digitsFromPrice > 0) monthlyRent = digitsFromPrice;

  const listingId = editingId || String(Date.now());
  let uploadedImages = [];
  let warning = "";

  if (photoFiles.length) {
    try {
      if (isSupabaseConfigured && supabase) {
        uploadedImages = await uploadFilesToSupabase(photoFiles, listingId);
      } else {
        warning = "Supabase Storage not configured — listing saved without photos.";
      }
    } catch (uploadErr) {
      reportClientError("listing_editor_media_upload", uploadErr);
      warning = "Photo upload failed: " + (uploadErr?.message || "unknown error") + ". Listing saved without photos.";
    }
  }

  const manualImages = String(form.imagesText || form.image || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
  let allImages = [...uploadedImages, ...manualImages];
  if (editingId && allImages.length === 0) {
    const prev = Array.isArray(existingListing?.images) ? existingListing.images.filter(Boolean) : [];
    allImages = prev;
  }

  const { contact: _legacyPublicPhone, ...formRest } = form;
  const payload = {
    ...formRest,
    ...extraFields,
    id: listingId,
    title: String(form.title || "").trim() || "Untitled listing",
    price: String(form.price || "").trim() || "Rent on request",
    address: String(form.address || "").trim(),
    area: String(form.area || "").trim(),
    city: String(form.city || "Bengaluru").trim(),
    seller: String(form.seller || "").trim() || "Seller",
    sellerEmail: email,
    ownerEmail: email,
    monthlyRent,
    lat: Number(pinPosition?.[0] ?? form.lat),
    lng: Number(pinPosition?.[1] ?? form.lng),
    preferredTenants: toList(form.preferredTenants, ["Family"]),
    parking: toList(form.parking, ["2 Wheeler"]),
    images: allImages,
    image: form.image || allImages[0] || existingListing?.image || "",
    status: form.status || "published",
    isHandover: !!form.isHandover,
    waterTimings: String(form.waterTimings || "").trim(),
    societyRules: String(form.societyRules || "").trim(),
    depositTerms: String(form.depositTerms || "").trim(),
    landlordInfo: String(form.landlordInfo || "").trim(),
    sizeSqft: form.sizeSqft ? Number(form.sizeSqft) : null,
    amenities: String(form.amenitiesText || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    furnishings: String(form.furnishingsText || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    updatedAt: new Date().toISOString(),
  };

  const saved = isFirebaseConfigured ? await upsertListingData(payload, actorUser) : upsertListing(payload);

  if (isFirebaseConfigured) {
    await upsertListingPrivateData(
      saved.id,
      {
        agentPhone: String(form.agentPhonePrivate || _legacyPublicPhone || "").trim(),
        ownerPhone: String(form.ownerPhonePrivate || "").trim(),
      },
      actorUser,
    );
  }

  return { saved, warning };
}

export function formatListingSaveError(err) {
  const code = err?.code;
  let msg = err?.message || String(err) || "Save failed.";
  if (code === "permission-denied") {
    msg =
      "Permission denied: sign in with the account that owns this listing, or ask admin to check Firestore rules.";
  } else if (code === "storage/unauthorized" || code === "storage/canceled") {
    msg = `Media upload failed (${code}). Check Storage rules and sign-in.`;
  }
  if (code) msg = `${msg} [${code}]`;
  return msg;
}
