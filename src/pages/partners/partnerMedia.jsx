/**
 * Listing photos for the partner app. Photos first; a video-only listing shows
 * its walkthrough muted rather than an empty box. Storage paths that are not
 * URLs go through SmartImage, which knows the older Firebase layouts.
 */
import { Home } from "lucide-react";
import SmartImage from "../../components/SmartImage";
import { isVideoUrl, orderListingMedia } from "../../lib/listingMedia";

export function listingMedia(l) {
  const all = orderListingMedia([l?.cover_image_url, ...(l?.images ?? [])].filter(Boolean));
  return [...new Set(all)];
}

export function MediaItem({ src, alt = "" }) {
  if (isVideoUrl(src)) {
    return <video src={src} muted playsInline preload="metadata" controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  if (/^https?:\/\//i.test(src)) return <img src={src} alt={alt} loading="lazy" />;
  return <SmartImage src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}

export function SmartListingImage({ listing }) {
  const [first] = listingMedia(listing);
  if (!first) {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#9CA3AF" }}>
        <Home size={40} />
      </div>
    );
  }
  return <MediaItem src={first} alt={listing?.title || ""} />;
}
