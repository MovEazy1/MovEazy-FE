/**
 * How long a property was looked at and how many of its photos were seen, for
 * tenant views (lib/tenantViews.js → flat_view_engage in tenant_views.sql).
 *
 * Time only counts while the tab is visible. It's sent when the tab is hidden
 * or the property closes — seconds since the last send (the server adds them
 * up) and the photos seen so far (the server keeps the most). The server only
 * keeps it against a page open it already counted, so a quick look from a list
 * goes nowhere.
 */
import { useEffect, useRef } from "react";
import { reportEngagement } from "../lib/tenantViews";

export default function useViewEngagement(propertyId, photoIndex) {
  const seen = useRef(new Set());
  useEffect(() => { if (photoIndex != null) seen.current.add(photoIndex); }, [photoIndex]);

  useEffect(() => {
    if (!propertyId || typeof document === "undefined") return undefined;
    seen.current = new Set([0]);
    let since = document.visibilityState === "visible" ? Date.now() : null;
    let ms = 0;
    let sentPhotos = 1; // the first photo is on screen as it opens: nothing new
    const flush = () => {
      if (since != null) { ms += Date.now() - since; since = null; }
      const secs = Math.round(ms / 1000);
      const photos = seen.current.size;
      if (secs < 2 && photos <= sentPhotos) return;
      reportEngagement(propertyId, secs, photos);
      ms -= secs * 1000;
      sentPhotos = photos;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else if (since == null) since = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [propertyId]);
}
