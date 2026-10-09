/**
 * The cover photo: one of the listing's photos, framed 4:3 by the poster.
 *
 * The frame starts as the largest 4:3 rectangle that fits the photo, centred;
 * the poster slides it and zooms in (PhotoReview). What they framed is saved as
 * its own JPEG — cover-<time>.jpg beside the photos — and becomes
 * cover_image_url, so every card, WhatsApp preview and poster shows exactly
 * that part. The gallery keeps the whole photos, in the poster's order.
 *
 * A crop is { cx, cy, zoom }: the frame's centre as fractions of the photo's
 * width and height, and how far in it is zoomed (1 = the largest frame).
 */
export const COVER_ASPECT = 4 / 3;
export const MAX_ZOOM = 4;
export const COVER_MAX_WIDTH = 1600;
export const DEFAULT_CROP = Object.freeze({ cx: 0.5, cy: 0.5, zoom: 1 });

/** The frame's size, in the photo's pixels, at this zoom. */
export function frameSize(width, height, zoom = 1, aspect = COVER_ASPECT) {
  const z = Math.min(MAX_ZOOM, Math.max(1, Number(zoom) || 1));
  const fit = width / height > aspect ? { w: height * aspect, h: height } : { w: width, h: width / aspect };
  return { w: fit.w / z, h: fit.h / z };
}

/** The crop moved back inside the photo, zoom kept between 1 and MAX_ZOOM. */
export function clampCrop(width, height, crop = DEFAULT_CROP, aspect = COVER_ASPECT) {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, Number(crop.zoom) || 1));
  const { w, h } = frameSize(width, height, zoom, aspect);
  const halfX = w / 2 / width;
  const halfY = h / 2 / height;
  const clamp = (v, half) => Math.min(1 - half, Math.max(half, Number.isFinite(v) ? v : 0.5));
  return { cx: clamp(crop.cx, halfX), cy: clamp(crop.cy, halfY), zoom };
}

/** The source rectangle to cut: { sx, sy, sw, sh } in the photo's pixels. */
export function cropRect(width, height, crop = DEFAULT_CROP, aspect = COVER_ASPECT) {
  const c = clampCrop(width, height, crop, aspect);
  const { w, h } = frameSize(width, height, c.zoom, aspect);
  return { sx: c.cx * width - w / 2, sy: c.cy * height - h / 2, sw: w, sh: h };
}

/** A cover this app made (rather than a plain photo standing in as the cover). */
export const isMadeCover = (url) => /\/cover-\d+\.jpe?g(\?|$)/i.test(String(url || ""));

/**
 * The gallery to show for a listing: its photos and videos. A made cover is a
 * framed copy of one of them, so it is left out rather than shown twice; an old
 * listing whose cover is just a photo keeps it first, as before.
 */
export function galleryOf(coverUrl, images = []) {
  const list = (images ?? []).filter(Boolean);
  if (!coverUrl || isMadeCover(coverUrl)) return [...new Set(list)];
  return [...new Set([coverUrl, ...list])];
}

async function bitmapOf(source) {
  const blob = typeof source === "string" ? await fetch(source, { mode: "cors" }).then((r) => r.blob()) : source;
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch { /* an <img> below */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The framed part of `source` (a File/Blob, or a photo's URL) as a 4:3 JPEG Blob. */
export async function makeCoverBlob(source, crop = DEFAULT_CROP) {
  const img = await bitmapOf(source);
  const W = img.width || img.naturalWidth;
  const H = img.height || img.naturalHeight;
  const { sx, sy, sw, sh } = cropRect(W, H, crop);
  const outW = Math.round(Math.min(COVER_MAX_WIDTH, sw));
  const outH = Math.round(outW / COVER_ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  img.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not make the cover photo.");
  return blob;
}

/**
 * Where a made cover came from and how it was framed rides on its own URL —
 * cover-<time>.jpg?src=<photo>&cx=..&cy=..&z=.. — so re-opening a listing puts
 * the frame back where it was, with nothing extra to store. Storage ignores
 * the query; every surface loads the same image.
 */
export function coverUrlWithCrop(url, src, crop = DEFAULT_CROP) {
  const base = String(url || "").split("?")[0];
  const q = new URLSearchParams({
    src: String(src || "").split("?")[0],
    cx: (Number(crop.cx) || 0.5).toFixed(4),
    cy: (Number(crop.cy) || 0.5).toFixed(4),
    z: (Number(crop.zoom) || 1).toFixed(3),
  });
  return `${base}?${q}`;
}

/** { src, crop } for a made cover's URL, or null. */
export function readCoverCrop(url) {
  if (!isMadeCover(url)) return null;
  const q = new URLSearchParams(String(url).split("?")[1] || "");
  const src = q.get("src");
  if (!src) return null;
  return { src, crop: { cx: Number(q.get("cx")) || 0.5, cy: Number(q.get("cy")) || 0.5, zoom: Number(q.get("z")) || 1 } };
}

/** Same photo, either side of a query string. */
export const sameMedia = (a, b) => String(a || "").split("?")[0] === String(b || "").split("?")[0];
