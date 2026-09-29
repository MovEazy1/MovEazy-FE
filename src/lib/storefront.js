/**
 * A broker's QR storefront — the page their printed poster opens
 * (moveazy.co.in/b/<code>) and the numbers behind it.
 *
 * The authority is MovEazy-BE/supabase/partner_storefront.sql: who may like,
 * rate and read is decided there. This file only calls it.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { PUBLIC_ORIGIN } from "./partners";

const PHOTO_BUCKET = "partner-photos";
const VISITOR_KEY = "mz_visitor";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** The public page for a code, always on moveazy.co.in. `qr` marks it as scanned from a poster. */
export const storefrontUrl = (code, { qr = false } = {}) => `${PUBLIC_ORIGIN}/b/${code}${qr ? "?s=qr" : ""}`;
export const storefrontDisplay = (code) => `moveazy.co.in/b/${code}`;

/* ── The public page ─────────────────────────────────────────────────────── */

export const fetchStorefront = (code) => rpc("partner_storefront", { p_code: String(code || "") });

/** This device's anonymous id, so a visitor is counted once a day. */
export function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function recordStorefrontView(code, source) {
  const v = visitorId();
  return rpc("partner_storefront_view", { p_code: code, p_visitor: v || "anonymous-visitor", p_source: source === "qr" ? "qr" : "link" })
    .catch(() => {});
}

export const likeStorefrontHome = (code, propertyId, on) =>
  rpc("partner_storefront_like", { p_code: code, p_property: propertyId, p_on: Boolean(on) });

export const rateStorefront = (code, stars) => rpc("partner_storefront_rate", { p_code: code, p_stars: stars });

/* ── The broker's side ───────────────────────────────────────────────────── */

export const fetchMyStorefront = () => rpc("partner_my_storefront");

/** A square, at most 720 px JPEG of the middle of `file` — small enough to load fast on a poster page. */
export async function squarePhoto(file, max = 720) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file isn't a photo we can read."));
      i.src = url;
    });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(max, s);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    canvas.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, out, out);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare the photo."))), "image/jpeg", 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Upload the broker's photo to their folder and put it on the storefront. Returns the public URL. */
export async function uploadStorefrontPhoto(uid, file) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const blob = await squarePhoto(file);
  const path = `${uid}/photo-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(data.path);
  await rpc("partner_set_storefront_photo", { p_url: pub.publicUrl });
  return pub.publicUrl;
}

export const removeStorefrontPhoto = () => rpc("partner_set_storefront_photo", { p_url: "" });
