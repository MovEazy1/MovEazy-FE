/**
 * Tap a flat's photo, see it full screen (components/PhotoViewer.jsx, loaded
 * on the first tap). `open(i)` from the photo's onClick; render `viewer`.
 * Videos play where they are, so tapping one does nothing here.
 */
import { lazy, Suspense, useCallback, useState } from "react";
import { isVideoUrl } from "../lib/listingMedia";

const PhotoViewer = lazy(() => import("../components/PhotoViewer"));

export function usePhotoViewer(media, title = "") {
  const [at, setAt] = useState(null);
  const open = useCallback((i) => {
    if (media?.[i] && !isVideoUrl(media[i])) setAt(i);
  }, [media]);
  const close = useCallback(() => setAt(null), []);
  const viewer = at == null ? null : (
    <Suspense fallback={null}>
      <PhotoViewer media={media} start={at} title={title} onClose={close} />
    </Suspense>
  );
  return { open, viewer };
}

export default usePhotoViewer;
