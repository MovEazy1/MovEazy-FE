/**
 * The glue between an upload form and PhotoReview: what to show it, which
 * cover to start on, and turning its answer into a saved cover URL.
 */
import { coverPhoto, isVideoFile, isVideoUrl, orderListingMedia } from "./listingMedia";
import { uploadMediaItemsKeyed } from "./mediaItems";
import { DEFAULT_CROP, coverUrlWithCrop, isMadeCover, makeCoverBlob, readCoverCrop, sameMedia } from "./coverCrop";
import { uploadCoverImage } from "./inventory";

/** The cover PhotoReview should open on: the one framed last time, or the photo already in use. */
export function initialCoverFor(items, coverUrl) {
  const made = readCoverCrop(coverUrl);
  if (made) {
    const hit = items.find((m) => !m.isVideo && sameMedia(m.src, made.src));
    if (hit) return { key: hit.key, crop: made.crop };
  }
  const plain = coverUrl && !isMadeCover(coverUrl) ? items.find((m) => !m.isVideo && sameMedia(m.src, coverUrl)) : null;
  return plain ? { key: plain.key, crop: { ...DEFAULT_CROP } } : null;
}

/** Did the poster add, remove or reorder anything since `savedSrcs`? */
export const photosChanged = (items, savedSrcs = []) =>
  items.length !== savedSrcs.length || items.some((m, i) => !sameMedia(m.src, savedSrcs[i]) || m.file);

/**
 * The cover to save when the review screen wasn't shown (a text-only edit):
 * the framed one, while the photo it came from is still on the listing;
 * otherwise the first photo, as always.
 */
export function keptCover(existingCoverUrl, images = []) {
  const made = readCoverCrop(existingCoverUrl);
  if (made && images.some((u) => sameMedia(u, made.src))) return existingCoverUrl;
  return coverPhoto(images);
}

/**
 * The cover URL for PhotoReview's answer. `source` is the chosen photo (a File,
 * or its URL) and `finalUrl` where that photo now lives. Unchanged from
 * last time: the existing cover, no new upload.
 */
export async function savedCoverUrl({ cover, source, finalUrl, folder, existingCoverUrl = "" }) {
  if (!cover || !source || !finalUrl || isVideoUrl(finalUrl)) return "";
  const before = readCoverCrop(existingCoverUrl);
  const same = before && sameMedia(before.src, finalUrl)
    && Math.abs(before.crop.cx - cover.crop.cx) < 1e-3 && Math.abs(before.crop.cy - cover.crop.cy) < 1e-3
    && Math.abs(before.crop.zoom - cover.crop.zoom) < 1e-3;
  if (same) return existingCoverUrl;
  try {
    const blob = await makeCoverBlob(source, cover.crop);
    const url = await uploadCoverImage(blob, folder);
    return coverUrlWithCrop(url, finalUrl, cover.crop);
  } catch {
    // The listing still saves; its first photo stands in, as before covers.
    return finalUrl;
  }
}

/** Review-screen items for a form that keeps parallel lists of files and their preview URLs. */
export const fileReviewItems = (files = [], previews = []) =>
  files.map((file, i) => ({ key: previews[i], src: previews[i], isVideo: isVideoFile(file), file }));

/**
 * Upload a form's picked files in the order the review screen settled (or as
 * picked, without one), and frame its chosen cover. → { images, coverImageUrl }
 */
export async function uploadReviewedFiles({ files, previews, rev, folder, onProgress, onFileError }) {
  const items = fileReviewItems(files, previews);
  const list = rev ? rev.order.map((k) => items.find((m) => m.key === k)).filter(Boolean) : items;
  const keyed = await uploadMediaItemsKeyed(list.map((m) => ({ key: m.key, file: m.file })), folder, onProgress, onFileError);
  const images = orderListingMedia(keyed.map((x) => x.url));
  const chosen = rev?.cover ? list.find((m) => m.key === rev.cover.key) : null;
  const coverImageUrl = chosen
    ? await savedCoverUrl({ cover: rev.cover, source: chosen.file, finalUrl: keyed.find((x) => x.key === chosen.key)?.url, folder })
    : "";
  return { images, coverImageUrl };
}

/**
 * Buildings keep their framed cover as photos[0] (there is no separate cover
 * column): split it off for editing, and put it back in front when saving.
 */
export function splitCover(photos = []) {
  const list = (photos ?? []).filter(Boolean);
  const cover = isMadeCover(list[0]) ? list[0] : "";
  return { cover, gallery: list.filter((u) => !isMadeCover(u)) };
}
export const withCover = (coverUrl, gallery = []) => (isMadeCover(coverUrl) ? [coverUrl, ...gallery] : [...gallery]);
