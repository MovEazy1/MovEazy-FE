/**
 * The photos and videos of a listing being edited, in the order the poster
 * wants them: some already on the listing, some picked just now. One list, so
 * a new photo can be dragged ahead of an old one.
 *
 *   { key, url }         already uploaded — `url` is the public URL
 *   { key, url, file }   picked just now — `url` is a preview (blob:) URL
 */
import { VIDEO_AFTER_PHOTOS, isVideoFile, isVideoUrl } from "./listingMedia";
import { uploadInventoryPhotos } from "./inventory";

let seq = 0;

export const savedItem = (url) => ({ key: url, url });
export const savedItems = (urls) => (Array.isArray(urls) ? urls.filter(Boolean).map(savedItem) : []);

export function newItem(file) {
  seq += 1;
  return { key: `new-${seq}-${file.name || "file"}`, url: URL.createObjectURL(file), file };
}

export const isVideoItem = (m) => (m.file ? isVideoFile(m.file) : isVideoUrl(m.url));

/** The order renters get (orderListingMedia, for items): photos first, and
 *  the video after the fourth photo. Applied after every move, so the grid
 *  shows what will be published. */
export function orderMediaItems(items = []) {
  const photos = items.filter((m) => !isVideoItem(m));
  const videos = items.filter(isVideoItem);
  if (!videos.length) return photos;
  return [...photos.slice(0, VIDEO_AFTER_PHOTOS), ...videos, ...photos.slice(VIDEO_AFTER_PHOTOS)];
}

/** Frees the preview URLs of the new items among `items`. */
export function releaseItems(items = []) {
  for (const m of items) if (m.file) URL.revokeObjectURL(m.url);
}

/** Uploads the new items and returns every URL, in the list's order. A file
 *  that fails is left out (and reported through `onFileError`). */
export async function uploadMediaItems(items, propertyId, onProgress, onFileError) {
  const total = items.filter((m) => m.file).length;
  const urls = [];
  let done = 0;
  for (const m of items) {
    if (!m.file) { urls.push(m.url); continue; }
    const [url] = await uploadInventoryPhotos([m.file], propertyId, null, onFileError);
    done += 1;
    onProgress?.(done, total);
    if (url) urls.push(url);
  }
  return urls;
}
