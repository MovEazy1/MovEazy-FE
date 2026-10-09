/**
 * Listing photos for the partner app. Photos first; a video-only listing shows
 * its walkthrough muted rather than an empty box. Storage paths that are not
 * URLs go through SmartImage, which knows the older Firebase layouts.
 */
import { useState } from "react";
import { Home } from "lucide-react";
import SmartImage from "../../components/SmartImage";
import { isVideoUrl, orderListingMedia } from "../../lib/listingMedia";
import ThumbImg from "../../components/ThumbImg";
import { galleryOf, isMadeCover } from "../../lib/coverCrop";

/** The gallery: every photo and video. A framed cover (lib/coverCrop.js) is a copy of one of them, so it isn't repeated here. */
export function listingMedia(l) {
  return orderListingMedia(galleryOf(l?.cover_image_url, l?.images ?? []));
}

/** What a card shows: the framed cover, or else the gallery's first photo. */
export function listingCover(l) {
  return isMadeCover(l?.cover_image_url) ? l.cover_image_url : listingMedia(l)[0];
}

export function MediaItem({ src, alt = "", thumb = false }) {
  if (isVideoUrl(src)) {
    return <video src={src} muted playsInline preload="metadata" controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  if (/^https?:\/\//i.test(src)) return <PhotoOrPlaceholder src={src} alt={alt} thumb={thumb} />;
  return <SmartImage src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}

/** A listing photo that falls back to the house icon if the file is gone. `thumb`: its small copy, for cards. */
function PhotoOrPlaceholder({ src, alt, thumb }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#9CA3AF" }}><Home size={36} /></div>;
  }
  if (thumb) return <ThumbImg src={src} alt={alt} onBroken={() => setBroken(true)} />;
  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
}

/** The listing's first photo. `thumb` for small places — cards, rows, tiles — which get the 480 px copy. */
export function SmartListingImage({ listing, thumb = false }) {
  const first = listingCover(listing);
  if (!first) {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#9CA3AF" }}>
        <Home size={40} />
      </div>
    );
  }
  return <MediaItem src={first} alt={listing?.title || ""} thumb={thumb} />;
}
