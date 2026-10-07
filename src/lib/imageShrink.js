/**
 * Listing photos at the size they are looked at.
 *
 * A phone camera shoots 4000 px and 2–5 MB; a phone screen is ~1080 px wide.
 * Every listing photo is stored at most 1600 px on its long side (sharp even
 * zoomed on a phone, ~250 KB), and a 480 px copy sits beside it under
 * `thumbs/` for cards and lists (~35 KB). Same URL, same path — the thumbnail's
 * address is derived from the photo's (thumbUrl), so nothing else has to store
 * it, and a photo with no thumbnail yet simply falls back to itself.
 *
 * JPEG on purpose: WhatsApp and Facebook link previews (and the share collage)
 * read these files too, and they don't all take WebP.
 */
export const MAIN_MAX = 1600;
export const THUMB_MAX = 480;
export const QUALITY = 0.82;
export const THUMBS_PREFIX = "thumbs/";

/** Width and height that fit inside `max` on the long side — never enlarged. */
export function fitWithin(width, height, max) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!w || !h) return { width: w, height: h };
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** The thumbnail's address for a photo in our listings bucket; anything else comes back unchanged. */
export function thumbUrl(src) {
  const s = String(src || "");
  const marker = "/storage/v1/object/public/listings/";
  const i = s.indexOf(marker);
  if (i < 0) return s;
  const rest = s.slice(i + marker.length);
  if (rest.startsWith(THUMBS_PREFIX) || !/\.(jpe?g|png|webp|heic|heif)(\?|$)/i.test(rest)) return s;
  return `${s.slice(0, i + marker.length)}${THUMBS_PREFIX}${rest}`;
}

/** The thumbnail's storage path for a photo stored at `path`. */
export const thumbPath = (path) => `${THUMBS_PREFIX}${path}`;

async function decode(blob) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch { /* try an <img> */ }
  }
  if (typeof Image === "undefined" || typeof URL === "undefined") return null;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The photo re-encoded to fit `max` px, as a JPEG Blob — or null when it can't
 * be read here (an iPhone HEIC on a browser that can't open it), in which case
 * the caller keeps the original. A photo already small enough is left alone.
 */
export async function shrinkImage(blob, max = MAIN_MAX, quality = QUALITY) {
  if (!blob || typeof document === "undefined") return null;
  const img = await decode(blob);
  if (!img) return null;
  const srcW = img.width || img.naturalWidth;
  const srcH = img.height || img.naturalHeight;
  const { width, height } = fitWithin(srcW, srcH, max);
  if (!width || !height) return null;
  // Already within size and modest: re-encoding would only lose quality.
  if (width === srcW && height === srcH && blob.size <= 150 * 1024 && /jpe?g/i.test(blob.type)) {
    img.close?.();
    return blob;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs get a white ground, not black
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  img.close?.();
  const out = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!out) return null;
  // Never trade a small original for a bigger copy.
  return out.size < blob.size || width < srcW ? out : blob;
}

/** A file name for the JPEG copy of `name` ("IMG_1234.HEIC" → "img_1234.jpg"). */
export function jpegName(name) {
  const base = String(name || "photo").replace(/\.[a-z0-9]+$/i, "");
  return `${base}.jpg`;
}
