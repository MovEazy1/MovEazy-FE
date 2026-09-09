/**
 * One place that decides what a listing's media *is* and what order it goes in.
 *
 * Photos and videos share the `inventory.images` column — a video is simply a
 * URL that ends in a video extension. That convention predates this file; what
 * didn't exist was one implementation of it. Eight components each had their
 * own `String(u).match(/\.(mp4|webm|ogg|mov)$/i) || String(u).includes("video")`,
 * which called any photo with "video" in its filename a video and disagreed
 * with its neighbours about query strings.
 *
 * Display order is a product rule, not a storage detail: photos come first, and
 * a video is shown after the fourth photo. A renter should see the flat before
 * they see a walkthrough of it, and a video parked at position one costs the
 * listing its thumbnail.
 */

const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|qt|3gp)(?:[?#]|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|svg)(?:[?#]|$)/i;

/** Where a video sits once there are enough photos to get past. */
export const VIDEO_AFTER_PHOTOS = 4;

/**
 * Is this URL a video?
 *
 * An explicit image extension settles it first, so `pool-video-tour.jpg` stays
 * a photo — the old `includes("video")` test got that wrong. A `/video/` path
 * segment is still honoured for anything stored before extensions were kept.
 */
export function isVideoUrl(url) {
  const s = String(url || "");
  if (!s) return false;
  if (IMAGE_EXT.test(s)) return false;
  if (VIDEO_EXT.test(s)) return true;
  return /\/videos?\//i.test(s);
}

export function isVideoFile(file) {
  if (!file) return false;
  if (String(file.type || "").startsWith("video/")) return true;
  return VIDEO_EXT.test(String(file.name || ""));
}

export function isImageFile(file) {
  return Boolean(file) && String(file.type || "").startsWith("image/");
}

/** Anything we accept into a listing gallery. */
export function isListingMediaFile(file) {
  return isImageFile(file) || isVideoFile(file);
}

export function splitMedia(urls = []) {
  const all = (urls || []).filter(Boolean);
  return { photos: all.filter((u) => !isVideoUrl(u)), videos: all.filter(isVideoUrl) };
}

/**
 * The order a listing's media is shown in: every photo in the poster's own
 * order, with the videos lifted in after the fourth of them. Fewer than four
 * photos and the videos simply follow the photos — never before them.
 *
 * Idempotent, so it is safe to apply again at any layer.
 */
export function orderListingMedia(urls = []) {
  const { photos, videos } = splitMedia(urls);
  if (!videos.length) return photos;
  return [
    ...photos.slice(0, VIDEO_AFTER_PHOTOS),
    ...videos,
    ...photos.slice(VIDEO_AFTER_PHOTOS),
  ];
}

/**
 * The cover: the first photo, never a video. A video frame can't be read at
 * card size, and a listing whose thumbnail is a black rectangle looks broken.
 */
export function coverPhoto(urls = []) {
  return (urls || []).find((u) => u && !isVideoUrl(u)) || "";
}

/** "3 photos · 1 video" — for upload counters and admin hints. */
export function describeMedia(urls = []) {
  const { photos, videos } = splitMedia(urls);
  const bits = [];
  if (photos.length) bits.push(`${photos.length} photo${photos.length === 1 ? "" : "s"}`);
  if (videos.length) bits.push(`${videos.length} video${videos.length === 1 ? "" : "s"}`);
  return bits.join(" · ") || "nothing yet";
}
